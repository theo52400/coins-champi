package io.github.theo52400.coinsachampi;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Alertes du groupe (SOS, « Venez voir ! », regroupement) en notification du téléphone, affichées tout de suite,
 * même quand l'appli est en arrière-plan pendant une sortie. Appelé depuis js/native.js.
 */
@CapacitorPlugin(
    name = "Alertes",
    permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) }
)
public class AlertesPlugin extends Plugin {

    static final String CHANNEL = "alertes-groupe";

    @Override
    public void load() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Alertes du groupe", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("SOS, « Venez voir ! » et regroupements envoyés par le groupe");
            ch.enableVibration(true);
            ch.setVibrationPattern(new long[] { 0, 250, 150, 250, 150, 400 });
            NotificationManager nm = getContext().getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    private JSObject state() {
        JSObject r = new JSObject();
        boolean ok = Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED;
        r.put("display", ok ? "granted" : "denied");
        return r;
    }

    @PluginMethod
    public void autoriser(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED) {
            call.resolve(state());
            return;
        }
        requestPermissionForAlias("notifications", call, "apresAutorisation");
    }

    @PermissionCallback
    private void apresAutorisation(PluginCall call) {
        call.resolve(state());
    }

    @PluginMethod
    public void afficher(PluginCall call) {
        Context ctx = getContext();
        String title = call.getString("title", "Coins à champi");
        String body = call.getString("body", "");
        Integer id = call.getInt("id");
        int nid = id != null ? id : (int) (System.currentTimeMillis() % 1000000);
        Intent open = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        PendingIntent pi = null;
        if (open != null) {
            open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
            pi = PendingIntent.getActivity(ctx, nid, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        }
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_champi)
            .setColor(0xFF4A2C8F)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true);
        if (pi != null) b.setContentIntent(pi);
        try {
            NotificationManagerCompat.from(ctx).notify(nid, b.build());
            JSObject r = new JSObject();
            r.put("id", nid);
            call.resolve(r);
        } catch (SecurityException e) {
            call.reject("Notifications refusées", e);
        }
    }
}
