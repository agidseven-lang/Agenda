package br.com.idseven.agenda

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Outline
import android.graphics.Paint
import android.graphics.Shader
import android.graphics.drawable.GradientDrawable
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewOutlineProvider
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.fragment.app.Fragment
import br.com.idseven.agenda.data.Session
import br.com.idseven.agenda.data.UserColor
import java.net.HttpURLConnection
import java.net.URL

// Topbar fiel ao PWA (.hrow): logo com anel, "ID Seven" + subtítulo + "sincronizado",
// e à direita sino, engrenagem e avatar do usuário. Reutilizado entre telas.
object Topbar {
    private val INK = Color.parseColor("#f1f2f4")
    private val SOFT = Color.parseColor("#9ba0ab")
    private val LINE = Color.parseColor("#262a36")
    private val ACCENT = Color.parseColor("#5b6cff")
    private val GREEN = Color.parseColor("#34d399")
    private val avatarCache = HashMap<String, Bitmap>()

    fun build(f: Fragment, photoUrl: String?, colorKey: String?): View = build(f.requireContext(), photoUrl, colorKey)

    fun build(ctx: Context, photoUrl: String?, colorKey: String?): View {
        val row = LinearLayout(ctx); row.orientation = LinearLayout.HORIZONTAL; row.gravity = Gravity.CENTER_VERTICAL
        val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT); lp.topMargin = dp(ctx, 4); lp.bottomMargin = dp(ctx, 18); row.layoutParams = lp

        row.addView(logoBadge(ctx))

        val brand = LinearLayout(ctx); brand.orientation = LinearLayout.VERTICAL
        val blp = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f); blp.leftMargin = dp(ctx, 11); blp.rightMargin = dp(ctx, 8); brand.layoutParams = blp
        val name = TextView(ctx); name.text = "ID Seven"; name.setTextColor(ACCENT); name.textSize = 15.5f
        name.setTypeface(name.typeface, android.graphics.Typeface.BOLD); name.letterSpacing = -0.01f; brand.addView(name)
        val sub = TextView(ctx); sub.text = "Agenda e Gestor de Tarefas"; sub.setTextColor(SOFT); sub.textSize = 10.5f; brand.addView(sub)
        val sync = LinearLayout(ctx); sync.orientation = LinearLayout.HORIZONTAL; sync.gravity = Gravity.CENTER_VERTICAL; sync.setPadding(0, dp(ctx, 3), 0, 0)
        val dot = View(ctx); val dlp = LinearLayout.LayoutParams(dp(ctx, 7), dp(ctx, 7)); dlp.rightMargin = dp(ctx, 6); dot.layoutParams = dlp
        val dg = GradientDrawable(); dg.shape = GradientDrawable.OVAL; dg.setColor(GREEN); dot.background = dg; sync.addView(dot)
        val st = TextView(ctx); st.text = "sincronizado"; st.setTextColor(SOFT); st.textSize = 10.5f; sync.addView(st)
        brand.addView(sync)
        row.addView(brand)

        row.addView(iconCircle(ctx, R.drawable.ic_bell))
        row.addView(iconCircle(ctx, R.drawable.ic_gear))

        val ring = UserColor.of(Session.uid(ctx), colorKey)
        val av = avatar(ctx, photoUrl, ring, Session.name(ctx), dp(ctx, 44), dp(ctx, 2))
        (av.layoutParams as LinearLayout.LayoutParams).leftMargin = dp(ctx, 8)
        row.addView(av)
        return row
    }

    fun avatar(f: Fragment, url: String?, ringColor: Int, name: String?, sizePx: Int, ringPx: Int): View =
        avatar(f.requireContext(), url, ringColor, name, sizePx, ringPx)

    // Avatar circular com anel colorido. Carrega foto (http ou data: base64) com fallback de iniciais.
    fun avatar(ctx: Context, url: String?, ringColor: Int, name: String?, sizePx: Int, ringPx: Int): View {
        val box = FrameLayout(ctx)
        val ring = GradientDrawable(); ring.shape = GradientDrawable.OVAL; ring.setColor(ringColor); box.background = ring
        box.setPadding(ringPx, ringPx, ringPx, ringPx)
        box.layoutParams = LinearLayout.LayoutParams(sizePx, sizePx)
        val img = ImageView(ctx); img.scaleType = ImageView.ScaleType.CENTER_CROP
        img.layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        box.addView(img)
        loadAvatar(img, url, sizePx - ringPx * 2, ringColor, UserColor.initials(name))
        return box
    }

    private fun logoBadge(ctx: Context): View {
        val box = FrameLayout(ctx)
        val ring = GradientDrawable(GradientDrawable.Orientation.TL_BR,
            intArrayOf(Color.parseColor("#22d3ee"), Color.parseColor("#5b6cff"), Color.parseColor("#f472b6")))
        ring.cornerRadius = dp(ctx, 14).toFloat(); box.background = ring; box.setPadding(dp(ctx, 2), dp(ctx, 2), dp(ctx, 2), dp(ctx, 2))
        box.layoutParams = LinearLayout.LayoutParams(dp(ctx, 46), dp(ctx, 46))
        val img = ImageView(ctx); img.setImageResource(R.drawable.logo); img.scaleType = ImageView.ScaleType.CENTER_CROP
        val ibg = GradientDrawable(); ibg.cornerRadius = dp(ctx, 12).toFloat(); ibg.setColor(Color.parseColor("#0c0d12")); img.background = ibg
        img.layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        roundClip(img, dp(ctx, 12))
        box.addView(img)
        return box
    }

    private fun iconCircle(ctx: Context, res: Int): View {
        val box = FrameLayout(ctx)
        val bg = GradientDrawable(); bg.shape = GradientDrawable.OVAL; bg.setColor(Color.parseColor("#171922")); bg.setStroke(dp(ctx, 1), LINE)
        box.background = bg
        val lp = LinearLayout.LayoutParams(dp(ctx, 40), dp(ctx, 40)); lp.leftMargin = dp(ctx, 8); box.layoutParams = lp
        val img = ImageView(ctx); img.setImageResource(res); img.setColorFilter(SOFT)
        val ilp = FrameLayout.LayoutParams(dp(ctx, 19), dp(ctx, 19)); ilp.gravity = Gravity.CENTER; img.layoutParams = ilp
        box.addView(img)
        return box
    }

    private fun loadAvatar(img: ImageView, url: String?, sizePx: Int, ringColor: Int, initials: String) {
        img.setImageBitmap(initialsBmp(sizePx, ringColor, initials))
        if (url.isNullOrBlank()) return
        avatarCache[url]?.let { img.setImageBitmap(it); return }
        Thread {
            try {
                val bmp: Bitmap? = if (url.startsWith("data:")) {
                    val b64 = url.substringAfter(",", "")
                    val bytes = android.util.Base64.decode(b64, android.util.Base64.DEFAULT)
                    BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                } else {
                    val con = (URL(url).openConnection() as HttpURLConnection)
                    con.connectTimeout = 8000; con.readTimeout = 8000; con.doInput = true; con.instanceFollowRedirects = true; con.connect()
                    val b = BitmapFactory.decodeStream(con.inputStream); con.disconnect(); b
                }
                if (bmp != null) {
                    val circ = circleBmp(bmp, sizePx); avatarCache[url] = circ
                    img.post { img.setImageBitmap(circ) }
                }
            } catch (_: Exception) { }
        }.start()
    }

    private fun circleBmp(src: Bitmap, size: Int): Bitmap {
        val s = minOf(src.width, src.height)
        val sq = Bitmap.createBitmap(src, (src.width - s) / 2, (src.height - s) / 2, s, s)
        val scaled = Bitmap.createScaledBitmap(sq, size, size, true)
        val out = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(out); val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        paint.shader = BitmapShader(scaled, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP)
        canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint)
        return out
    }
    private fun initialsBmp(size: Int, color: Int, initials: String): Bitmap {
        val out = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(out)
        val bg = Paint(Paint.ANTI_ALIAS_FLAG)
        bg.color = Color.rgb((Color.red(color) * 0.8f).toInt(), (Color.green(color) * 0.8f).toInt(), (Color.blue(color) * 0.8f).toInt())
        canvas.drawCircle(size / 2f, size / 2f, size / 2f, bg)
        val tp = Paint(Paint.ANTI_ALIAS_FLAG); tp.color = Color.WHITE; tp.textAlign = Paint.Align.CENTER
        tp.textSize = size * 0.40f; tp.isFakeBoldText = true
        val fm = tp.fontMetrics
        canvas.drawText(initials, size / 2f, size / 2f - (fm.ascent + fm.descent) / 2f, tp)
        return out
    }
    private fun roundClip(view: View, radiusPx: Int) {
        view.outlineProvider = object : ViewOutlineProvider() {
            override fun getOutline(v: View, o: Outline) { o.setRoundRect(0, 0, v.width, v.height, radiusPx.toFloat()) }
        }
        view.clipToOutline = true
    }
    private fun dp(ctx: Context, v: Int): Int = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), ctx.resources.displayMetrics).toInt()
}
