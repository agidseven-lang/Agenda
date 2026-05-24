package br.com.idseven.agenda

import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import br.com.idseven.agenda.data.EventRepo
import br.com.idseven.agenda.data.Session

// Criação de compromisso — grava na MESMA coleção/schema do PWA (events).
class EventFormActivity : AppCompatActivity() {

    private val dateRegex = Regex("^\\d{4}-\\d{2}-\\d{2}$")
    private val timeRegex = Regex("^\\d{1,2}:\\d{2}$")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_event_form)

        val inCliente = findViewById<EditText>(R.id.inCliente)
        val inTitulo = findViewById<EditText>(R.id.inTitulo)
        val inData = findViewById<EditText>(R.id.inData)
        val inInicio = findViewById<EditText>(R.id.inInicio)
        val inFim = findViewById<EditText>(R.id.inFim)
        val erro = findViewById<TextView>(R.id.txtErro)
        val btn = findViewById<Button>(R.id.btnSalvar)

        btn.setOnClickListener {
            erro.text = ""
            val cliente = inCliente.text.toString().trim()
            val titulo = inTitulo.text.toString().trim()
            val data = inData.text.toString().trim()
            val inicio = inInicio.text.toString().trim()
            val fim = inFim.text.toString().trim()

            if (cliente.isEmpty() && titulo.isEmpty()) {
                erro.text = "Informe o cliente ou o título."; return@setOnClickListener
            }
            if (!dateRegex.matches(data)) {
                erro.text = "Data no formato AAAA-MM-DD."; return@setOnClickListener
            }
            if (inicio.isNotEmpty() && !timeRegex.matches(inicio)) {
                erro.text = "Hora inicial no formato HH:MM."; return@setOnClickListener
            }
            if (fim.isNotEmpty() && !timeRegex.matches(fim)) {
                erro.text = "Hora final no formato HH:MM."; return@setOnClickListener
            }

            val now = System.currentTimeMillis()
            val uid = Session.uid(this)
            val data0 = HashMap<String, Any?>()
            data0["type"] = "outro"
            if (cliente.isNotEmpty()) data0["client"] = cliente
            if (titulo.isNotEmpty()) data0["title"] = titulo
            data0["date"] = data
            if (inicio.isNotEmpty()) data0["start"] = inicio
            if (fim.isNotEmpty()) data0["end"] = fim
            data0["owner"] = Session.name(this) ?: ""
            data0["ownerId"] = uid
            data0["by"] = uid
            data0["done"] = false
            data0["createdAt"] = now
            data0["updatedAt"] = now

            btn.isEnabled = false
            btn.text = "Salvando..."
            EventRepo.create(
                data0,
                onOk = {
                    runOnUiThread { finish() } // volta pra agenda; o listener atualiza a lista
                },
                onError = { msg ->
                    runOnUiThread {
                        erro.text = msg
                        btn.isEnabled = true
                        btn.text = "Salvar"
                    }
                }
            )
        }
    }
}
