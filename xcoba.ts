import path from "path";
import fs from "fs/promises";
import dotenv from "dotenv";
import { existsSync } from "fs";

async function updateEnvWithEncodedCookies() {
  const envPath = path.join(process.cwd(), ".env");
  const cookiesPath = path.join(process.cwd(), "cookies.txt");

  try {
    // Validasi file yang dibutuhkan
    if (!existsSync(envPath)) {
      throw new Error(".env file tidak ditemukan");
    }
    if (!existsSync(cookiesPath)) {
      throw new Error("cookies.txt tidak ditemukan");
    }

    // Baca dan parse file .env
    const envText = await fs.readFile(envPath, "utf-8");
    const envParse = dotenv.parse(envText);

    // Baca dan encode cookies
    const cookiesText = await fs.readFile(cookiesPath, "utf-8");
    if (!cookiesText.trim()) {
      throw new Error("cookies.txt kosong");
    }

    // Encode cookies ke base64
    const encodedCookies = Buffer.from(cookiesText).toString("base64");

    // Update environment variables
    envParse.APP_COOKIES = encodedCookies;

    // Convert ke format .env
    const envString = Object.entries(envParse)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    // Backup .env lama
    const backupPath = `${envPath}.backup`;
    await fs.copyFile(envPath, backupPath);

    // Tulis .env baru
    await fs.writeFile(envPath, envString, { mode: 0o600 }); // Set permissions to 600

    console.log("✅ Berhasil memperbarui .env");
    console.log("📝 Backup tersimpan di:", backupPath);
    
    return {
      success: true,
      envString,
      backupPath
    };
  } catch (error) {
    console.error("❌ Error:", error);
    return {
      success: false,
      error: error
    };
  }
}

// Jalankan fungsi
(async () => {
  const result = await updateEnvWithEncodedCookies();
  
  if (!result.success) {
    process.exit(1);
  }
})();