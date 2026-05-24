package br.com.idseven.agenda.smoke

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.widget.TextView

// Activity Android PURO (sem ReactActivity / sem React Native).
class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val tv = TextView(this)
        tv.text = "ID Seven Android nativo abriu"
        tv.textSize = 20f
        tv.gravity = Gravity.CENTER
        tv.setBackgroundColor(Color.parseColor("#0b0c0f"))
        tv.setTextColor(Color.WHITE)
        setContentView(tv)
    }
}
