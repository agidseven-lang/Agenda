package br.com.idseven.agenda.nativebeta.features.tasks

// Templates dinâmicos por SETOR de tarefa (Quadros). UI-only: os campos específicos
// são serializados no campo `desc` (briefing) e o checklist padrão preenche o checklist
// já existente — sem alterar o schema do Firestore. Cada setor tem sua própria estrutura.

enum class FieldKind { TEXT, CHOICE, BOOL }

data class TplField(
    val key: String,
    val label: String,
    val kind: FieldKind,
    val options: List<String> = emptyList(),
    val placeholder: String = "",
)

data class SectorTpl(
    val titleLabel: String,            // rótulo do campo "Título" específico do setor
    val titlePlaceholder: String,
    val fields: List<TplField>,        // campos específicos -> serializados em desc
    val checklist: List<String>,       // checklist padrão do setor
)

object TaskTemplates {
    val bySector: Map<String, SectorTpl> = mapOf(
        "edicao_midia" to SectorTpl(
            titleLabel = "Título da edição",
            titlePlaceholder = "Ex.: Reels institucional — corte 30s",
            fields = listOf(
                TplField("tipo_peca", "Tipo de peça", FieldKind.CHOICE, listOf("Reels", "Stories", "Feed", "YouTube", "Institucional")),
                TplField("material_recebido", "Material recebido?", FieldKind.BOOL),
                TplField("orientacoes", "Orientações de edição", FieldKind.TEXT, placeholder = "Cortes, ritmo, trilha, legendas…"),
            ),
            checklist = listOf("Cortar", "Legendar", "Inserir identidade visual", "Revisar", "Exportar", "Entregar"),
        ),
        "cronograma" to SectorTpl(
            titleLabel = "Nome do cronograma",
            titlePlaceholder = "Ex.: Cronograma de junho",
            fields = listOf(
                TplField("periodo", "Período", FieldKind.TEXT, placeholder = "Ex.: 01/06 a 30/06"),
                TplField("canais", "Canais", FieldKind.CHOICE, listOf("Instagram", "Facebook", "YouTube", "WhatsApp")),
                TplField("qtd_posts", "Quantidade de posts", FieldKind.TEXT, placeholder = "Ex.: 12"),
                TplField("observacoes", "Observações", FieldKind.TEXT, placeholder = "Notas do cronograma…"),
            ),
            checklist = listOf("Definir temas", "Organizar datas", "Aprovar cronograma", "Enviar para produção"),
        ),
        "copywriting" to SectorTpl(
            titleLabel = "Título da copy",
            titlePlaceholder = "Ex.: Legenda lançamento",
            fields = listOf(
                TplField("tipo_copy", "Tipo de copy", FieldKind.CHOICE, listOf("Legenda", "Anúncio", "Roteiro curto", "Chamada", "Carrossel")),
                TplField("objetivo", "Objetivo", FieldKind.CHOICE, listOf("Engajamento", "Conversão", "Autoridade", "Captação")),
                TplField("tom_voz", "Tom de voz", FieldKind.TEXT, placeholder = "Ex.: próximo, confiante"),
                TplField("cta", "CTA", FieldKind.TEXT, placeholder = "Chamada para ação"),
                TplField("observacoes", "Observações", FieldKind.TEXT, placeholder = "Notas da copy…"),
            ),
            checklist = listOf("Escrever", "Revisar", "Aprovar", "Entregar"),
        ),
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
        "programacao_posts" to SectorTpl(
            titleLabel = "Título da programação",
            titlePlaceholder = "Ex.: Post lançamento — feed",
            fields = listOf(
                TplField("canal", "Canal", FieldKind.CHOICE, listOf("Instagram", "Facebook", "YouTube", "WhatsApp")),
                TplField("tipo_conteudo", "Tipo de conteúdo", FieldKind.CHOICE, listOf("Feed", "Reels", "Stories", "Carrossel")),
                TplField("legenda_aprovada", "Legenda aprovada?", FieldKind.BOOL),
                TplField("arte_aprovada", "Arte aprovada?", FieldKind.BOOL),
            ),
            checklist = listOf("Revisar arte", "Revisar legenda", "Agendar", "Publicar", "Confirmar publicação"),
        ),
    )

    fun forSector(key: String?): SectorTpl? = bySector[key]
}
