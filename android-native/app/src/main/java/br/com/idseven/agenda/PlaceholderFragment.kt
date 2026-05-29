package br.com.idseven.agenda

import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.fragment.app.Fragment

class PlaceholderFragment : Fragment() {
    override fun onCreateView(i: LayoutInflater, c: ViewGroup?, s: Bundle?): View {
        val box = LinearLayout(requireContext())
        box.orientation = LinearLayout.VERTICAL
        box.gravity = Gravity.CENTER
        box.setBackgroundColor(Color.parseColor("#0b0c0f"))
        box.setPadding(40, 40, 40, 40)
        val t = TextView(requireContext())
        t.text = arguments?.getString("title") ?: ""
        t.setTextColor(Color.WHITE); t.textSize = 22f; t.gravity = Gravity.CENTER
        val m = TextView(requireContext())
        m.text = arguments?.getString("msg") ?: ""
        m.setTextColor(Color.parseColor("#9aa0ac")); m.gravity = Gravity.CENTER; m.setPadding(0, 16, 0, 0)
        box.addView(t); box.addView(m)
        return box
    }

    companion object {
        fun of(title: String, msg: String): PlaceholderFragment {
            val f = PlaceholderFragment()
            f.arguments = Bundle().apply { putString("title", title); putString("msg", msg) }
            return f
        }
    }
}
