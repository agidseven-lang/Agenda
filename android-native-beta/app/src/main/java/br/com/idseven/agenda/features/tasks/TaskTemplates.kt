package br.com.idseven.agenda.features.tasks

// Templates dinâmicos por SETOR + SUBTIPO (Quadros). A escolha do subtipo
// (Semanal/Quinzenal/Mensal ou 4/6/12) TROCA o formulário exibido. UI-only:
// tudo é serializado em `desc`/`checklist` (sem alterar schema do Firestore).

enum class FieldKind { TEXT, CHOICE, BOOL }

data class TplField(
    val key: String,
    val label: String,
    val kind: FieldKind,
    val options: List<String> = emptyList(),
    val placeholder: String = "",
)

// Subtipo de um setor (ex.: Cronograma Semanal/Quinzenal/Mensal; Edição 4/6/12).
// `contentCount` > 0: gera N blocos de CONTEÚDO, cada um com Tema + Legenda (Cronograma).
// `itemLabels`: lista simples de 1 campo por item (Edição: Vídeo/Roteiro 1..N).
data class SubType(
    val key: String,
    val label: String,        // rótulo curto do chip (ex.: "Semanal", "4 vídeos/roteiros")
    val formTitle: String,    // título do subformulário (ex.: "Cronograma semanal")
    val fields: List<TplField> = emptyList(),
    val itemLabels: List<String> = emptyList(), // lista compacta de 1 campo (ex.: Vídeo/Roteiro 1..N)
    val contentCount: Int = 0,                   // nº de conteúdos (Tema+Legenda) — Cronograma
    val dayLabels: Boolean = false,              // rotula "Conteúdo i / iº dia" (semanal)
    val checklist: List<String> = emptyList(),
)

data class SectorTpl(
    val titleLabel: String,
    val titlePlaceholder: String,
    val subtypeLabel: String? = null,         // null = setor sem subtipos
    val subtypes: List<SubType> = emptyList(),
    val fields: List<TplField> = emptyList(), // usado quando NÃO há subtipos
    val checklist: List<String> = emptyList(),
) {
    fun subtypeOf(key: String?): SubType? = subtypes.firstOrNull { it.key == key }
}

private fun videoItems(n: Int): List<String> = (1..n).map { "Vídeo/Roteiro $it" }

object TaskTemplates {
    private val CANAIS = listOf("Instagram", "Facebook", "YouTube", "WhatsApp")

    val bySector: Map<String, SectorTpl> = mapOf(
        // ───────────── EDIÇÃO DE MÍDIA (pacote 4/6/12) ─────────────
        "edicao_midia" to SectorTpl(
            titleLabel = "Título da edição",
            titlePlaceholder = "Ex.: Reels institucional — corte 30s",
            subtypeLabel = "Pacote",
            subtypes = listOf(
                SubType(
                    "p4", "4 vídeos/roteiros", "Edição — pacote 4 vídeos/roteiros",
                    fields = listOf(TplField("orientacoes", "Orientações gerais", FieldKind.TEXT, placeholder = "Cortes, ritmo, trilha, identidade…")),
                    itemLabels = videoItems(4),
                    checklist = listOf("Receber materiais", "Editar 4 vídeos", "Revisar", "Aprovar", "Entregar"),
                ),
                SubType(
                    "p6", "6 vídeos/roteiros", "Edição — pacote 6 vídeos/roteiros",
                    fields = listOf(TplField("orientacoes", "Orientações gerais", FieldKind.TEXT, placeholder = "Cortes, ritmo, trilha, identidade…")),
                    itemLabels = videoItems(6),
                    checklist = listOf("Receber materiais", "Editar 6 vídeos", "Revisar", "Aprovar", "Entregar"),
                ),
                SubType(
                    "p12", "12 vídeos/roteiros", "Edição — pacote 12 vídeos/roteiros",
                    fields = listOf(TplField("orientacoes", "Orientações gerais", FieldKind.TEXT, placeholder = "Cortes, ritmo, trilha, identidade…")),
                    itemLabels = videoItems(12),
                    checklist = listOf("Receber materiais", "Editar 12 vídeos", "Revisar", "Aprovar", "Entregar"),
                ),
            ),
        ),
        // ───────────── CRONOGRAMA (semanal/quinzenal/mensal) ─────────────
        "cronograma" to SectorTpl(
            titleLabel = "Nome do cronograma",
            titlePlaceholder = "Ex.: Cronograma de junho",
            subtypeLabel = "Tipo de cronograma",
            subtypes = listOf(
                SubType(
                    "semanal", "Semanal", "Cronograma semanal",
                    fields = listOf(
                        TplField("semana_ref", "Semana de referência", FieldKind.TEXT, placeholder = "Ex.: 03/06 a 09/06"),
                        TplField("canais", "Canais", FieldKind.CHOICE, CANAIS),
                    ),
                    contentCount = 3, dayLabels = true,
                    checklist = listOf("Definir temas da semana", "Organizar datas", "Revisar cronograma", "Aprovar cronograma semanal", "Enviar para produção"),
                ),
                SubType(
                    "quinzenal", "Quinzenal", "Cronograma quinzenal",
                    fields = listOf(
                        TplField("periodo", "Período da quinzena", FieldKind.TEXT, placeholder = "Ex.: 03/06 a 16/06"),
                        TplField("canais", "Canais", FieldKind.CHOICE, CANAIS),
                    ),
                    contentCount = 6,
                    checklist = listOf("Definir temas da quinzena", "Distribuir conteúdos por semana", "Revisar cronograma", "Aprovar cronograma quinzenal", "Enviar para produção"),
                ),
                SubType(
                    "mensal", "Mensal", "Cronograma mensal",
                    fields = listOf(
                        TplField("mes_ref", "Mês de referência", FieldKind.TEXT, placeholder = "Ex.: Junho/2026"),
                        TplField("canais", "Canais", FieldKind.CHOICE, CANAIS),
                    ),
                    contentCount = 12,
                    checklist = listOf("Definir temas do mês", "Organizar calendário mensal", "Revisar cronograma", "Aprovar cronograma mensal", "Enviar para produção"),
                ),
            ),
        ),
        // ───────────── COPYWRITING (semanal/quinzenal/mensal) ─────────────
        "copywriting" to SectorTpl(
            titleLabel = "Título da copy",
            titlePlaceholder = "Ex.: Pacote de legendas",
            subtypeLabel = "Pacote de conteúdo",
            subtypes = listOf(
                SubType(
                    "semanal", "Semanal", "Copywriting semanal",
                    fields = listOf(
                        TplField("semana_ref", "Semana de referência", FieldKind.TEXT, placeholder = "Ex.: 03/06 a 09/06"),
                        TplField("qtd", "Quantidade de textos", FieldKind.TEXT, placeholder = "Ex.: 3"),
                        TplField("tipo_conteudo", "Tipo de conteúdo", FieldKind.CHOICE, listOf("Legenda", "Anúncio", "Roteiro curto", "Chamada", "Carrossel")),
                        TplField("objetivo", "Objetivo", FieldKind.CHOICE, listOf("Engajamento", "Conversão", "Autoridade", "Captação")),
                        TplField("tom", "Tom de voz", FieldKind.TEXT),
                        TplField("cta", "CTA principal", FieldKind.TEXT),
                        TplField("obs", "Observações", FieldKind.TEXT),
                    ),
                    checklist = listOf("Escrever copies da semana", "Revisar", "Aprovar", "Entregar"),
                ),
                SubType(
                    "quinzenal", "Quinzenal", "Copywriting quinzenal",
                    fields = listOf(
                        TplField("periodo", "Período da quinzena", FieldKind.TEXT, placeholder = "Ex.: 03/06 a 16/06"),
                        TplField("qtd", "Quantidade de textos", FieldKind.TEXT, placeholder = "Ex.: 6"),
                        TplField("objetivo", "Objetivo da quinzena", FieldKind.CHOICE, listOf("Engajamento", "Conversão", "Autoridade", "Captação")),
                        TplField("tom", "Tom de voz", FieldKind.TEXT),
                        TplField("ctas", "CTAs principais", FieldKind.TEXT),
                        TplField("obs", "Observações", FieldKind.TEXT),
                    ),
                    checklist = listOf("Escrever copies da quinzena", "Revisar", "Aprovar", "Entregar"),
                ),
                SubType(
                    "mensal", "Mensal", "Copywriting mensal",
                    fields = listOf(
                        TplField("mes_ref", "Mês de referência", FieldKind.TEXT, placeholder = "Ex.: Junho/2026"),
                        TplField("qtd", "Quantidade de textos no mês", FieldKind.TEXT, placeholder = "Ex.: 12"),
                        TplField("campanhas", "Campanhas/temas principais", FieldKind.TEXT),
                        TplField("tom", "Tom de voz", FieldKind.TEXT),
                        TplField("ctas", "CTAs principais", FieldKind.TEXT),
                        TplField("obs", "Observações", FieldKind.TEXT),
                    ),
                    checklist = listOf("Escrever copies do mês", "Revisar", "Aprovar", "Entregar"),
                ),
            ),
        ),
        // ───────────── ROTEIRO (sem subtipo) ─────────────
        "roteiro" to SectorTpl(
            titleLabel = "Título do roteiro",
            titlePlaceholder = "Ex.: Roteiro Reels — bastidores",
            fields = listOf(
                TplField("tipo_roteiro", "Tipo de roteiro", FieldKind.CHOICE, listOf("Reels", "YouTube", "Story", "Institucional", "Captação")),
                TplField("gancho", "Gancho", FieldKind.TEXT, placeholder = "Primeiros 3 segundos"),
                TplField("desenvolvimento", "Desenvolvimento", FieldKind.TEXT, placeholder = "Estrutura do conteúdo"),
                TplField("cta", "CTA", FieldKind.TEXT, placeholder = "Chamada para ação"),
                TplField("obs_gravacao", "Observações de gravação", FieldKind.TEXT, placeholder = "Locação, enquadramento…"),
            ),
            checklist = listOf("Criar gancho", "Estruturar roteiro", "Revisar", "Aprovar", "Enviar para gravação"),
        ),
        // ───────────── PROGRAMAÇÃO DE POSTS (sem subtipo) ─────────────
        "programacao_posts" to SectorTpl(
            titleLabel = "Título da programação",
            titlePlaceholder = "Ex.: Post lançamento — feed",
            fields = listOf(
                TplField("canal", "Canal", FieldKind.CHOICE, CANAIS),
                TplField("tipo_conteudo", "Tipo de conteúdo", FieldKind.CHOICE, listOf("Feed", "Reels", "Stories", "Carrossel")),
                TplField("legenda_aprovada", "Legenda aprovada?", FieldKind.BOOL),
                TplField("arte_aprovada", "Arte aprovada?", FieldKind.BOOL),
            ),
            checklist = listOf("Revisar arte", "Revisar legenda", "Agendar", "Publicar", "Confirmar publicação"),
        ),
    )

    fun forSector(key: String?): SectorTpl? = bySector[key]
}
