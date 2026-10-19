package com.ymusic.player;

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
