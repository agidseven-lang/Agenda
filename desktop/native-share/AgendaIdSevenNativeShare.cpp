// =====================================================================
// F3.3.74C — Agenda ID Seven · Native Share Helper (Windows Share Contract)
// ---------------------------------------------------------------------
// PROPÓSITO: entregar ao WhatsApp Business (ou outro alvo escolhido pelo
// usuário) UM ÚNICO DataPackage contendo simultaneamente:
//   • StorageItems  → o PNG do Card Premium (arquivo temporário validado);
//   • Text          → a legenda completa (inclui a URL de aprovação);
//   • WebLink       → a URL de aprovação (https, validada no app);
//   • Properties.Title / Description / Thumbnail;
//   • Bitmap (RandomAccessStreamReference) p/ alvos que preferem bitmap.
// O helper NÃO é um app visível: é chamado pelo processo main do Electron
// (spawn com stdio pipeado), cria uma janela mínima só para ancorar o
// Share UI (IDataTransferManagerInterop::ShowShareUIForWindow — o Share
// Source do Windows NÃO exige package identity) e encerra ao concluir.
//
// ENTRADA:  arquivo de requisição UTF-8 (argv[2] em modo "share"), linhas
//   chave<TAB>valor. Campos: type, image, captionB64, url, titleB64,
//   descB64, trace. (caption/título/descrição em base64 p/ preservar
//   quebras de linha; a URL é pública por definição.)
// SAÍDA:    eventos JSON, um por linha, no stdout (telemetria SANITIZADA:
//   nunca legenda completa, nunca URL completa, nunca cliente/token/JWT —
//   apenas flags, tamanhos, host, nome do alvo e duração).
// MODOS:    share <request-file>   → abre o Share UI (fluxo real)
//           --selftest <png-file>  → monta o DataPackage e RELÊ via
//                                    GetView() provando que os formatos
//                                    coexistem (gate de CI; sem UI).
// Compilação (CI windows-latest): cl /std:c++20 /EHsc /permissive- /O2
//   /DUNICODE /D_UNICODE AgendaIdSevenNativeShare.cpp
//   /link WindowsApp.lib user32.lib ole32.lib shell32.lib
//   (C++20: os headers C++/WinRT do Windows SDK atual exigem C++20.)
// =====================================================================
#include <windows.h>
#include <shobjidl_core.h>   // IDataTransferManagerInterop
#include <winrt/base.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Foundation.Collections.h>
#include <winrt/Windows.ApplicationModel.DataTransfer.h>
#include <winrt/Windows.Storage.h>
#include <winrt/Windows.Storage.Streams.h>
#include <cstdio>
#include <cstdint>
#include <string>
#include <vector>
#include <fstream>
#include <sstream>
#include <thread>
#include <chrono>

using namespace winrt;
using namespace Windows::Foundation;
using namespace Windows::ApplicationModel::DataTransfer;
using namespace Windows::Storage;
using namespace Windows::Storage::Streams;

// ── util: eventos sanitizados (JSON por linha; flush imediato p/ o pipe) ──
static ULONGLONG g_t0 = 0;
static void emitRaw(const std::string& s) { std::fputs(s.c_str(), stdout); std::fputc('\n', stdout); std::fflush(stdout); }
static std::string jesc(const std::wstring& w) {
    std::string out; out.reserve(w.size());
    for (wchar_t c : w) {
        if (c == L'"' || c == L'\\') { out.push_back('\\'); out.push_back((char)c); }
        else if (c == L'\n' || c == L'\r' || c == L'\t') { out.push_back(' '); }
        else if (c < 128) { out.push_back((char)c); }
        else { out.push_back('?'); }
    }
    return out;
}
static void emitEvt(const char* evt, const std::string& extraJson = "") {
    ULONGLONG dur = GetTickCount64() - g_t0;
    std::ostringstream os;
    os << "{\"evt\":\"" << evt << "\"";
    if (!extraJson.empty()) os << "," << extraJson;
    os << ",\"durationMs\":" << dur << "}";
    emitRaw(os.str());
}

// ── util: base64 decode (ASCII/UTF-8) ──
static std::string b64decode(const std::string& in) {
    static const int T[256] = { /* preenchido em runtime */ };
    static int table[256]; static bool init = false;
    if (!init) { for (int i = 0; i < 256; i++) table[i] = -1;
        const char* A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        for (int i = 0; i < 64; i++) table[(unsigned char)A[i]] = i; init = true; }
    (void)T;
    std::string out; int val = 0, valb = -8;
    for (unsigned char c : in) {
        if (table[c] == -1) { if (c == '=') break; continue; }
        val = (val << 6) + table[c]; valb += 6;
        if (valb >= 0) { out.push_back((char)((val >> valb) & 0xFF)); valb -= 8; }
    }
    return out;
}
static std::wstring utf8ToW(const std::string& s) {
    if (s.empty()) return L"";
    int n = MultiByteToWideChar(CP_UTF8, 0, s.c_str(), (int)s.size(), nullptr, 0);
    std::wstring w(n, L'\0');
    MultiByteToWideChar(CP_UTF8, 0, s.c_str(), (int)s.size(), &w[0], n);
    return w;
}

// ── request ──
struct ShareReq {
    std::wstring type, imagePath, caption, url, title, desc, trace;
};
static bool readReq(const wchar_t* path, ShareReq& r, std::string& err) {
    std::ifstream f(path, std::ios::binary);
    if (!f) { err = "req_file_ausente"; return false; }
    std::string line;
    while (std::getline(f, line)) {
        if (!line.empty() && line.back() == '\r') line.pop_back();
        size_t tab = line.find('\t');
        if (tab == std::string::npos) continue;
        std::string k = line.substr(0, tab), v = line.substr(tab + 1);
        if (k == "type") r.type = utf8ToW(v);
        else if (k == "image") r.imagePath = utf8ToW(v);
        else if (k == "captionB64") r.caption = utf8ToW(b64decode(v));
        else if (k == "url") r.url = utf8ToW(v);
        else if (k == "titleB64") r.title = utf8ToW(b64decode(v));
        else if (k == "descB64") r.desc = utf8ToW(b64decode(v));
        else if (k == "trace") r.trace = utf8ToW(v);
    }
    if (r.type != L"SCHEDULE" && r.type != L"VIDEO_SCRIPT") { err = "tipo_invalido"; return false; }
    if (r.imagePath.empty()) { err = "imagem_ausente"; return false; }
    if (r.caption.empty()) { err = "legenda_ausente"; return false; }
    if (r.url.rfind(L"https://", 0) != 0) { err = "url_invalida"; return false; }
    if (r.caption.find(r.url) == std::wstring::npos) { err = "legenda_sem_link"; return false; }
    if (r.title.empty()) r.title = (r.type == L"VIDEO_SCRIPT") ? L"Aprovar roteiro" : L"Aprovar cronograma";
    return true;
}
static bool validPng(const std::wstring& path, uint64_t& size) {
    std::ifstream f(path, std::ios::binary);
    if (!f) return false;
    unsigned char sig[8] = { 0 };
    f.read((char*)sig, 8);
    static const unsigned char PNG[8] = { 0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A };
    if (memcmp(sig, PNG, 8) != 0) return false;
    f.seekg(0, std::ios::end); size = (uint64_t)f.tellg();
    return size >= 1024;
}

// ── estado global do fluxo de share ──
static ShareReq g_req;
static StorageFile g_file{ nullptr };
static DataTransferManager g_dtm{ nullptr };
static HWND g_hwnd = nullptr;
static bool g_done = false;

static std::string urlMeta(const std::wstring& url) {
    // sanitizado: só host + comprimento (nunca a URL completa)
    std::wstring host; size_t p = url.find(L"://");
    if (p != std::wstring::npos) { size_t q = url.find(L'/', p + 3); host = url.substr(p + 3, (q == std::wstring::npos ? url.size() : q) - p - 3); }
    std::ostringstream os; os << "\"urlHost\":\"" << jesc(host) << "\",\"urlLen\":" << url.size();
    return os.str();
}

static void configurePackage(DataPackage const& dp) {
    dp.Properties().Title(hstring(g_req.title));
    dp.Properties().Description(hstring(g_req.desc.empty() ? g_req.title : g_req.desc));
    dp.Properties().ApplicationName(L"Agenda ID Seven Desktop");
    dp.SetText(hstring(g_req.caption));
    emitEvt("text_attached", "\"captionLen\":" + std::to_string(g_req.caption.size()));
    dp.SetWebLink(Uri(hstring(g_req.url)));
    emitEvt("web_link_attached", urlMeta(g_req.url));
    auto items = winrt::single_threaded_vector<IStorageItem>();
    items.Append(g_file);
    dp.SetStorageItems(items);
    auto streamRef = RandomAccessStreamReference::CreateFromFile(g_file);
    dp.SetBitmap(streamRef);
    dp.Properties().Thumbnail(streamRef);
    emitEvt("image_attached", "\"fileName\":\"card.png\"");
    emitEvt("data_package_ready");
}

// ── janela mínima que ancora o Share UI ──
static LRESULT CALLBACK WndProc(HWND h, UINT m, WPARAM w, LPARAM l) {
    switch (m) {
    case WM_TIMER: if (w == 1) { emitEvt("share_timeout"); g_done = true; PostQuitMessage(3); } return 0;
    case WM_DESTROY: PostQuitMessage(0); return 0;
    }
    return DefWindowProcW(h, m, w, l);
}

static int runShare(const wchar_t* reqPath) {
    emitEvt("helper_started");
    std::string err;
    if (!readReq(reqPath, g_req, err)) { emitEvt("helper_failed", "\"reason\":\"" + err + "\""); return 10; }
    uint64_t pngSize = 0;
    if (!validPng(g_req.imagePath, pngSize)) { emitEvt("helper_failed", "\"reason\":\"png_invalido\""); return 11; }

    // pré-carrega o StorageFile em MTA (evita .get() bloqueante na STA da UI)
    std::exception_ptr fileErr;
    std::thread t([&] {
        try { winrt::init_apartment(winrt::apartment_type::multi_threaded);
              g_file = StorageFile::GetFileFromPathAsync(hstring(g_req.imagePath)).get(); }
        catch (...) { fileErr = std::current_exception(); }
    });
    t.join();
    if (fileErr || !g_file) { emitEvt("helper_failed", "\"reason\":\"storagefile_falhou\""); return 12; }

    // janela âncora (pequena, discreta, em primeiro plano — o flyout do Share cola nela)
    WNDCLASSW wc{}; wc.lpfnWndProc = WndProc; wc.hInstance = GetModuleHandleW(nullptr);
    wc.lpszClassName = L"AgendaIdSevenShareAnchor"; wc.hbrBackground = (HBRUSH)(COLOR_WINDOW + 1);
    RegisterClassW(&wc);
    int sx = GetSystemMetrics(SM_CXSCREEN), sy = GetSystemMetrics(SM_CYSCREEN);
    g_hwnd = CreateWindowExW(WS_EX_TOOLWINDOW | WS_EX_TOPMOST, wc.lpszClassName,
        L"Compartilhar — Agenda ID Seven", WS_POPUP, sx / 2 - 8, sy / 2 - 8, 16, 16,
        nullptr, nullptr, wc.hInstance, nullptr);
    if (!g_hwnd) { emitEvt("helper_failed", "\"reason\":\"janela_falhou\""); return 13; }
    ShowWindow(g_hwnd, SW_SHOW);
    SetForegroundWindow(g_hwnd);

    // Share Source clássico p/ Win32 (Raymond Chen): factory interop + GetForWindow
    auto interop = winrt::get_activation_factory<DataTransferManager, IDataTransferManagerInterop>();
    winrt::com_ptr<::IUnknown> unk;
    HRESULT hr = interop->GetForWindow(g_hwnd, winrt::guid_of<DataTransferManager>(), unk.put_void());
    if (FAILED(hr)) { emitEvt("helper_failed", "\"reason\":\"interop_getforwindow\""); return 14; }
    g_dtm = unk.as<DataTransferManager>();

    g_dtm.DataRequested([](DataTransferManager const&, DataRequestedEventArgs const& e) {
        DataPackage dp = e.Request().Data();
        configurePackage(dp);
        dp.ShareCompleted([](DataPackage const&, ShareCompletedEventArgs const& a) {
            std::wstring tgt;
            try { auto st = a.ShareTarget(); if (st) { auto ai = st.AppUserModelId(); tgt = std::wstring(ai); } } catch (...) {}
            emitEvt("share_completed", "\"target\":\"" + jesc(tgt) + "\"");
            g_done = true; PostQuitMessage(0);
        });
        dp.ShareCanceled([](DataPackage const&, winrt::Windows::Foundation::IInspectable const&) {
            emitEvt("share_canceled");
            g_done = true; PostQuitMessage(2);
        });
    });
    g_dtm.TargetApplicationChosen([](DataTransferManager const&, TargetApplicationChosenEventArgs const& a) {
        emitEvt("target_selected", "\"targetName\":\"" + jesc(std::wstring(a.ApplicationName())) + "\"");
    });

    hr = interop->ShowShareUIForWindow(g_hwnd);
    if (FAILED(hr)) { emitEvt("helper_failed", "\"reason\":\"showshareui\""); return 15; }
    emitEvt("share_ui_opened");
    SetTimer(g_hwnd, 1, 180000, nullptr); // 3 min: honesto — dismiss sem evento vira timeout

    MSG msg;
    int code = 0;
    while (GetMessageW(&msg, nullptr, 0, 0)) { TranslateMessage(&msg); DispatchMessageW(&msg); }
    code = (int)msg.wParam;
    if (!g_done) emitEvt("share_dismissed");
    return code;
}

// ── FASE 12: prova do pacote — monta e RELÊ (sem UI; gate de CI) ──
static int runSelfTest(const wchar_t* pngPath) {
    winrt::init_apartment(winrt::apartment_type::multi_threaded);
    emitEvt("helper_started", "\"mode\":\"selftest\"");
    uint64_t sz = 0;
    if (!validPng(pngPath, sz)) { emitEvt("helper_failed", "\"reason\":\"png_invalido\""); return 11; }
    g_req.type = L"SCHEDULE";
    g_req.caption = L"Olá, Cliente Sintético QA.\nSeu cronograma está pronto.\nhttps://idseven-push-qa.agidseven.workers.dev/share/cronograma/qacronsynthetic0000000000000000000000000001\nEquipe ID Seven";
    g_req.url = L"https://idseven-push-qa.agidseven.workers.dev/share/cronograma/qacronsynthetic0000000000000000000000000001";
    g_req.title = L"Aprovar cronograma";
    g_req.desc = L"Seu cronograma está pronto para avaliação.";
    try { g_file = StorageFile::GetFileFromPathAsync(hstring(pngPath)).get(); }
    catch (...) { emitEvt("helper_failed", "\"reason\":\"storagefile_falhou\""); return 12; }
    DataPackage dp;
    configurePackage(dp);
    DataPackageView v = dp.GetView();
    bool hasFiles = v.Contains(StandardDataFormats::StorageItems());
    bool hasText = v.Contains(StandardDataFormats::Text());
    bool hasLink = v.Contains(StandardDataFormats::WebLink());
    std::wstring title(v.Properties().Title());
    std::wstring desc(v.Properties().Description());
    // relê os VALORES (não só flags): itens/texto/link de volta do pacote
    uint32_t nItems = 0; size_t textLen = 0; std::wstring backHost;
    try { auto its = v.GetStorageItemsAsync().get(); nItems = its.Size(); } catch (...) {}
    try { textLen = std::wstring(v.GetTextAsync().get()).size(); } catch (...) {}
    try { Uri u = v.GetWebLinkAsync().get(); backHost = std::wstring(u.Host()); } catch (...) {}
    std::ostringstream os;
    os << "\"storageItems\":" << (hasFiles ? "true" : "false")
       << ",\"text\":" << (hasText ? "true" : "false")
       << ",\"webLink\":" << (hasLink ? "true" : "false")
       << ",\"titlePresent\":" << (!title.empty() ? "true" : "false")
       << ",\"descPresent\":" << (!desc.empty() ? "true" : "false")
       << ",\"itemCount\":" << nItems
       << ",\"textLen\":" << textLen
       << ",\"linkHost\":\"" << jesc(backHost) << "\"";
    emitEvt("selftest_result", os.str());
    bool ok = hasFiles && hasText && hasLink && !title.empty() && !desc.empty() && nItems == 1 && textLen > 40 && !backHost.empty();
    emitEvt(ok ? "selftest_ok" : "selftest_fail");
    return ok ? 0 : 20;
}

int WINAPI wWinMain(HINSTANCE, HINSTANCE, PWSTR, int) {
    g_t0 = GetTickCount64();
    int argc = 0;
    LPWSTR* argv = CommandLineToArgvW(GetCommandLineW(), &argc);
    if (!argv || argc < 3) { emitEvt("helper_failed", "\"reason\":\"argumentos\""); return 9; }
    std::wstring mode = argv[1];
    int rc = 9;
    if (mode == L"--selftest") rc = runSelfTest(argv[2]);
    else if (mode == L"share") { winrt::init_apartment(winrt::apartment_type::single_threaded); rc = runShare(argv[2]); }
    else emitEvt("helper_failed", "\"reason\":\"modo_desconhecido\"");
    LocalFree(argv);
    return rc;
}
