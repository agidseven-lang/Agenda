package br.com.idseven.agenda

import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.fragment.app.Fragment
import br.com.idseven.agenda.data.Perm
import br.com.idseven.agenda.data.Session

class PerfilFragment : Fragment() {
    override fun onCreateView(i: LayoutInflater, c: ViewGroup?, s: Bundle?): View {
        val ctx = requireContext()
        val box = LinearLayout(ctx)
        box.orientation = LinearLayout.VERTICAL
        box.gravity = Gravity.CENTER
        box.setBackgroundColor(Color.parseColor("#0b0c0f"))
        box.setPadding(40, 40, 40, 40)

        val nome = Session.name(ctx).takeUnless { it.isNullOrBlank() } ?: "usuário"
        val t = TextView(ctx); t.text = nome; t.setTextColor(Color.WHITE); t.textSize = 22f; t.gravity = Gravity.CENTER
        box.addView(t)

        val papel = TextView(ctx)
        papel.text = if (Perm.canManage(nome)) "Administrador (cria e gerencia)" else "Equipe (recebe e executa)"
        papel.setTextColor(Color.parseColor("#9aa0ac")); papel.gravity = Gravity.CENTER; papel.setPadding(0, 10, 0, 30)
        box.addView(papel)

        val sair = Button(ctx); sair.text = "Sair"; sair.setTextColor(Color.WHITE); sair.setBackgroundColor(Color.parseColor("#5b6cff"))
        sair.setOnClickListener {
            Session.clear(ctx)
            val i2 = Intent(ctx, MainActivity::class.java)
            i2.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            startActivity(i2); requireActivity().finish()
        }
        box.addView(sair)
        return box
    }
}
