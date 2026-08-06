/**
 * F3.5.5D — Menu de contexto NATIVO de edição (Desktop 1.0.223).
 *
 * Causa provada (herdada da F3.5.3): o app remove o menu de aplicação (main.ts removeMenu)
 * e NUNCA teve um handler de 'context-menu' — clicar com o botão direito num campo editável
 * não oferecia NADA (Colar pelo menu era impossível em todo o app). Este módulo instala o
 * menu profissional com os ROLES NATIVOS do Electron (undo/redo/cut/copy/paste/selectAll,
 * rótulos PT-BR), exibido SOMENTE quando o alvo é realmente editável (params.isEditable —
 * campos readOnly/disabled, botões, cards e labels ficam de fora) e com cada ação
 * habilitada conforme os editFlags reais do Chromium (ação indisponível aparece desabilitada).
 *
 * Segurança: nada de execCommand como arquitetura; nenhuma exposição de clipboard ao
 * renderer além dos IPCs read-only já existentes; contextIsolation intocado; NENHUM conteúdo
 * do campo/clipboard é registrado em log (apenas o evento, sem payload de texto).
 *
 * Injeção de dependência: `deps.Menu` é injetado pelo main (produção = Menu do Electron),
 * permitindo teste hermético do template/gating sem o binário do Electron.
 */

export type EditMenuItem = {
  role?: string;
  label?: string;
  enabled?: boolean;
  type?: string;
};

export type EditContextMenuDeps = {
  Menu: { buildFromTemplate(items: EditMenuItem[]): { popup(opts?: unknown): void } };
  onLog?: (evt: string, payload?: Record<string, unknown>) => void;
};

/**
 * Monta o template do menu para os params de 'context-menu' do Electron.
 * Retorna null quando o alvo NÃO é editável (nenhum menu deve aparecer).
 * Exportado separadamente para a suíte hermética e para as provas Electron.
 */
export function buildEditMenuTemplate(params: unknown): EditMenuItem[] | null {
  const p = (params || {}) as { isEditable?: boolean; editFlags?: Record<string, boolean>; selectionText?: string };
  if (!p.isEditable) return null; // botões/cards/labels/readOnly/disabled → sem menu
  const ef = p.editFlags || {};
  const hasSel = typeof p.selectionText === "string" && p.selectionText.length > 0;
  return [
    { role: "undo", label: "Desfazer", enabled: !!ef.canUndo },
    { role: "redo", label: "Refazer", enabled: !!ef.canRedo },
    { type: "separator" },
    { role: "cut", label: "Recortar", enabled: !!ef.canCut && hasSel },
    { role: "copy", label: "Copiar", enabled: !!ef.canCopy && hasSel },
    { role: "paste", label: "Colar", enabled: !!ef.canPaste },
    { type: "separator" },
    { role: "selectAll", label: "Selecionar tudo", enabled: !!ef.canSelectAll },
  ];
}

/** Liga o menu nativo ao webContents da janela (chamado no createWindow do main). */
export function attachEditContextMenu(
  wc: { on(evt: string, cb: (...a: unknown[]) => void): void },
  deps: EditContextMenuDeps,
): void {
  wc.on("context-menu", (...args: unknown[]) => {
    try {
      const params = args[1];
      const tpl = buildEditMenuTemplate(params);
      if (!tpl) return;
      const menu = deps.Menu.buildFromTemplate(tpl);
      menu.popup();
      if (deps.onLog) deps.onLog("edit.contextmenu.shown", { editable: true }); // sem conteúdo de campo/clipboard
    } catch {
      /* o menu nunca pode derrubar a janela */
    }
  });
}
