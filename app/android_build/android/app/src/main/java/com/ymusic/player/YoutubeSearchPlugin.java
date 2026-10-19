package com.ymusic.player;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URLEncoder;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;

@CapacitorPlugin(name = "YoutubeSearch")
public class YoutubeSearchPlugin extends Plugin {
    private static final String SEARCH_URL = "https://www.youtube.com/results?search_query=";

    @PluginMethod
    public void search(PluginCall call) {
        String query = call.getString("query", "").trim();
        int limit = Math.max(1, Math.min(call.getInt("limit", 12), 20));
        if (query.isEmpty()) {
            call.reject("عبارة البحث لا يمكن أن تكون فارغة");
            return;
        }
        new Thread(() -> {
            try {
                String html = requestHtml(query);
                JSONObject initialData = getInitialData(html);
                JSArray results = findVideoRenderers(initialData, limit);
                JSObject output = new JSObject();
                output.put("results", results);
                call.resolve(output);
            } catch (Exception error) {
                call.reject("تعذر تحميل نتائج YouTube: " + error.getMessage());
            }
        }).start();
    }

    private String requestHtml(String query) throws Exception {
        URL url = new URL(SEARCH_URL + URLEncoder.encode(query, StandardCharsets.UTF_8.name()));
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(20000);
        connection.setReadTimeout(20000);
        connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36");
        connection.setRequestProperty("Accept-Language", "ar,en-US;q=0.9,en;q=0.8");
        connection.setRequestProperty("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
        if (connection.getResponseCode() < 200 || connection.getResponseCode() >= 300) {
            throw new Exception("YouTube returned " + connection.getResponseCode());
        }
        StringBuilder body = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) body.append(line).append('\n');
        } finally {
            connection.disconnect();
        }
        return body.toString();
    }

    private JSONObject getInitialData(String html) throws Exception {
        String[] markers = {"var ytInitialData = ", "ytInitialData = "};
        int start = -1;
        for (String marker : markers) {
            int markerIndex = html.indexOf(marker);
            if (markerIndex >= 0) {
                start = markerIndex + marker.length();
                break;
            }
        }
        if (start < 0) throw new Exception("لم نعثر على بيانات نتائج يوتيوب في الصفحة");
        int depth = 0;
        boolean inString = false;
        boolean escaped = false;
        for (int index = start; index < html.length(); index++) {
            char character = html.charAt(index);
            if (inString) {
                if (escaped) escaped = false;
                else if (character == '\\') escaped = true;
                else if (character == '"') inString = false;
                continue;
            }
            if (character == '"') {
                inString = true;
                continue;
            }
            if (character == '{') depth++;
            if (character == '}') {
                depth--;
                if (depth == 0) return new JSONObject(html.substring(start, index + 1));
            }
        }
        throw new Exception("صيغة بيانات يوتيوب غير متوقعة");
    }

    private JSArray findVideoRenderers(Object node, int limit) throws Exception {
        JSArray results = new JSArray();
        Set<String> seen = new HashSet<>();
        walk(node, results, seen, limit);
        return results;
    }

    private void walk(Object node, JSArray results, Set<String> seen, int limit) throws Exception {
        if (results.length() >= limit || node == null) return;
        if (node instanceof JSONObject) {
            JSONObject object = (JSONObject) node;
            JSONObject renderer = object.optJSONObject("videoRenderer");
            if (renderer != null) {
                String id = renderer.optString("videoId", "");
                if (!id.isEmpty() && seen.add(id)) {
                    JSObject item = new JSObject();
                    item.put("id", id);
                    item.put("title", textFrom(renderer.optJSONObject("title"), "بدون عنوان"));
                    item.put("channel", textFrom(renderer.optJSONObject("ownerText"), "قناة غير معروفة"));
                    item.put("duration", textFrom(renderer.optJSONObject("lengthText"), "غير معروف"));
                    item.put("views", textFrom(renderer.optJSONObject("viewCountText"), "مشاهدات غير معروفة"));
                    item.put("published", textFrom(renderer.optJSONObject("publishedTimeText"), "حديثًا"));
                    item.put("thumbnail", thumbnailFrom(renderer, id));
                    item.put("url", "https://www.youtube.com/watch?v=" + id);
                    results.put(item);
                }
            }
            JSONArray names = object.names();
            if (names != null) for (int index = 0; index < names.length(); index++) walk(object.opt(names.getString(index)), results, seen, limit);
        } else if (node instanceof JSONArray) {
            JSONArray array = (JSONArray) node;
            for (int index = 0; index < array.length(); index++) walk(array.opt(index), results, seen, limit);
        }
    }

    private String textFrom(JSONObject value, String fallback) {
        if (value == null) return fallback;
        String simple = value.optString("simpleText", "");
        if (!simple.isEmpty()) return simple;
        JSONArray runs = value.optJSONArray("runs");
        if (runs != null) {
            StringBuilder result = new StringBuilder();
            for (int index = 0; index < runs.length(); index++) result.append(runs.optJSONObject(index).optString("text", ""));
            if (result.length() > 0) return result.toString();
        }
        return fallback;
    }

    private String thumbnailFrom(JSONObject renderer, String id) {
        JSONObject thumbnail = renderer.optJSONObject("thumbnail");
        JSONArray thumbnails = thumbnail == null ? null : thumbnail.optJSONArray("thumbnails");
        if (thumbnails != null && thumbnails.length() > 0) {
            return thumbnails.optJSONObject(thumbnails.length() - 1).optString("url", "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg");
        }
        return "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg";
    }
}
