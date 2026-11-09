package ro.aicaracter.gicu;

import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.plugin.java.JavaPlugin;

/**
 * GICU — plugin pentru Paper 1.21.4.
 *
 * Faza 0 (acest fișier): schelet care se încarcă pe server, își citește
 * configul și expune /gicu status. Scopul fazei 0 este ca jar-ul să se
 * construiască automat (GitHub Actions) și să poată fi urcat în plugins/.
 *
 * Faza 1: client intern (MCProtocolLib) care se conectează la localhost,
 *         deci Gicu apare ca jucător real fără niciun VPS.
 * Faza 2: creierul AI (HTTP către API-ul LLM) + uneltele.
 * Faza 3: voce pentru toți jucătorii, prin API-ul Simple Voice Chat.
 */
public final class GicuPlugin extends JavaPlugin {

    private int statusTaskId = -1;

    @Override
    public void onEnable() {
        saveDefaultConfig();

        String version = getDescription().getVersion();
        getLogger().info("GICU " + version + " pornit pe Paper " + Bukkit.getMinecraftVersion());
        getLogger().info("Faza 0: schelet activ. Clientul intern și AI-ul vin în fazele următoare.");

        scheduleStatus();
    }

    @Override
    public void onDisable() {
        if (statusTaskId != -1) {
            Bukkit.getScheduler().cancelTask(statusTaskId);
            statusTaskId = -1;
        }
        getLogger().info("GICU oprit.");
    }

    private void scheduleStatus() {
        int seconds = getConfig().getInt("status-interval-seconds", 300);
        if (seconds <= 0) {
            return;
        }
        long ticks = seconds * 20L;
        statusTaskId = Bukkit.getScheduler()
                .runTaskTimer(this, this::logStatus, ticks, ticks)
                .getTaskId();
    }

    private void logStatus() {
        getLogger().info("GICU activ. Jucători online: " + Bukkit.getOnlinePlayers().size());
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!command.getName().equalsIgnoreCase("gicu")) {
            return false;
        }
        if (args.length > 0 && args[0].equalsIgnoreCase("reload")) {
            reloadConfig();
            if (statusTaskId != -1) {
                Bukkit.getScheduler().cancelTask(statusTaskId);
            }
            scheduleStatus();
            sender.sendMessage("[GICU] Config recitit.");
            return true;
        }

        sender.sendMessage("[GICU] versiunea " + getDescription().getVersion()
                + " | jucători online: " + Bukkit.getOnlinePlayers().size()
                + " | faza: schelet (fără client intern încă)");
        return true;
    }
}
