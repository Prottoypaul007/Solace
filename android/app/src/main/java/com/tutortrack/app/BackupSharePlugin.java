package com.tutortrack.app;

import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "BackupShare")
public class BackupSharePlugin extends Plugin {
    @PluginMethod
    public void shareBackup(PluginCall call) {
        String filename = call.getString("filename");
        String content = call.getString("content");
        if (filename == null || !filename.matches("solace-(?:device-|server-)?backup-\\d{4}-\\d{2}-\\d{2}\\.json") || content == null) {
            call.reject("Invalid backup file.");
            return;
        }
        shareFile(call, filename, content, "application/json", "Save Solace backup");
    }

    @PluginMethod
    public void shareStatement(PluginCall call) {
        String filename = call.getString("filename");
        String content = call.getString("content");
        if (filename == null || !filename.matches("solace-statement-\\d{4}-\\d{2}\\.csv") || content == null) {
            call.reject("Invalid statement file.");
            return;
        }
        shareFile(call, filename, content, "text/csv", "Save Solace statement");
    }

    private void shareFile(PluginCall call, String filename, String content, String mimeType, String title) {
        try {
            File backupDirectory = new File(getContext().getCacheDir(), "backups");
            if (!backupDirectory.exists() && !backupDirectory.mkdirs()) {
                throw new IllegalStateException("Could not create backup folder.");
            }
            File backupFile = new File(backupDirectory, filename);
            try (FileOutputStream output = new FileOutputStream(backupFile)) {
                output.write(content.getBytes(StandardCharsets.UTF_8));
            }

            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", backupFile);
            Intent share = new Intent(Intent.ACTION_SEND);
            share.setType(mimeType);
            share.putExtra(Intent.EXTRA_STREAM, uri);
            share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(Intent.createChooser(share, title));
            call.resolve(new JSObject());
        } catch (Exception error) {
            call.reject("Could not share backup: " + error.getMessage());
        }
    }
}
