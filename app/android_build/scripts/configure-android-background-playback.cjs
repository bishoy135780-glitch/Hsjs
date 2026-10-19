const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const androidRoot = path.join(projectRoot, "android");
const config = JSON.parse(fs.readFileSync(path.join(projectRoot, "capacitor.config.json"), "utf8"));
const appId = config.appId;

if (!fs.existsSync(androidRoot)) {
  console.warn("Android project not found. Run: npm run setup");
  process.exit(0);
}

const packagePath = path.join(androidRoot, "app", "src", "main", "java", ...appId.split("."));
const resPath = path.join(androidRoot, "app", "src", "main", "res");
const manifestPath = path.join(androidRoot, "app", "src", "main", "AndroidManifest.xml");
fs.mkdirSync(packagePath, { recursive: true });
fs.mkdirSync(path.join(resPath, "layout"), { recursive: true });

const backgroundWebView = `package ${appId};

import android.content.Context;
import android.util.AttributeSet;
import android.view.View;
import com.getcapacitor.CapacitorWebView;

/** Keeps Chromium media playback alive when Android hides the activity. */
public class BackgroundCapacitorWebView extends CapacitorWebView {
    public BackgroundCapacitorWebView(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    @Override
    protected void onWindowVisibilityChanged(int visibility) {
        if (visibility == View.GONE) {
            return;
        }
        super.onWindowVisibilityChanged(View.VISIBLE);
    }
}
`;

const playbackService = `package ${appId};

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;

public class PlaybackForegroundService extends Service {
    private static final String CHANNEL_ID = "ymusic-playback";
    private static final int NOTIFICATION_ID = 7179;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle("YMusic")
            .setContentText("تشغيل الموسيقى في الخلفية")
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, 2);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "YMusic playback", NotificationManager.IMPORTANCE_LOW
            );
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
`;

const mainActivity = `package ${appId};

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.content.Intent;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int NOTIFICATION_PERMISSION_REQUEST = 7179;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureBackgroundMediaPlayback();
        requestMediaNotificationPermission();
        startPlaybackService();
    }

    private void configureBackgroundMediaPlayback() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        WebView webView = getBridge().getWebView();
        WebSettings settings = webView.getSettings();
        settings.setMediaPlaybackRequiresUserGesture(false);
        webView.setKeepScreenOn(false);
        webView.resumeTimers();
        webView.onResume();
    }

    @Override
    public void onPause() {
        super.onPause();
        keepWebPlaybackRunning();
    }

    @Override
    public void onStop() {
        super.onStop();
        keepWebPlaybackRunning();
    }

    private void keepWebPlaybackRunning() {
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().resumeTimers();
            getBridge().getWebView().onResume();
        }
    }

    private void requestMediaNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                this,
                new String[] { Manifest.permission.POST_NOTIFICATIONS },
                NOTIFICATION_PERMISSION_REQUEST
            );
        }
    }

    private void startPlaybackService() {
        Intent intent = new Intent(this, PlaybackForegroundService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent);
        } else {
            startService(intent);
        }
    }
}
`;

const layout = `<?xml version="1.0" encoding="utf-8"?>
<androidx.coordinatorlayout.widget.CoordinatorLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent">
    <${appId}.BackgroundCapacitorWebView
        android:id="@+id/webview"
        android:layout_width="match_parent"
        android:layout_height="match_parent" />
</androidx.coordinatorlayout.widget.CoordinatorLayout>
`;

fs.writeFileSync(path.join(packagePath, "BackgroundCapacitorWebView.java"), backgroundWebView);
fs.writeFileSync(path.join(packagePath, "PlaybackForegroundService.java"), playbackService);
fs.writeFileSync(path.join(packagePath, "MainActivity.java"), mainActivity);
fs.writeFileSync(path.join(resPath, "layout", "capacitor_bridge_layout_main.xml"), layout);

let manifest = fs.readFileSync(manifestPath, "utf8");
for (const permission of [
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
  "android.permission.WAKE_LOCK",
  "android.permission.POST_NOTIFICATIONS",
]) {
  if (!manifest.includes(permission)) {
    manifest = manifest.replace(
      "<application",
      `    <uses-permission android:name="${permission}" />\n\n    <application`,
    );
  }
}
fs.writeFileSync(manifestPath, manifest);
if (!manifest.includes("PlaybackForegroundService")) {
  manifest = manifest.replace(
    "</application>",
    '        <service android:name=".PlaybackForegroundService" android:exported="false" android:foregroundServiceType="mediaPlayback" />\n    </application>',
  );
  fs.writeFileSync(manifestPath, manifest);
}
console.log("Android background media playback configuration applied.");
