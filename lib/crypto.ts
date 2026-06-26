import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto"

import { env } from "@/lib/env"

// Cifratura simmetrica per i SEGRETI salvati nel database (oggi: la password
// SMTP nelle impostazioni di sistema). AES-256-GCM è autenticato: oltre a
// cifrare garantisce che il testo non sia stato manomesso. La chiave si deriva
// da SETTINGS_SECRET (vedi lib/env.ts) con scrypt, così la env può essere una
// passphrase qualsiasi e non per forza 32 byte esatti.
//
// Il formato del valore cifrato è `iv:authTag:dati` in base64: tre pezzi
// separati da ":", abbastanza per decifrare senza altri metadati. La chiave
// resta solo in memoria di processo e non viene mai loggata né persistita.

const ALGORITHM = "aes-256-gcm"
// Salt fisso e versionato: legare la derivazione a una costante d'app va bene
// perché la sicurezza dipende da SETTINGS_SECRET, non dalla segretezza del salt.
const KEY_SALT = "shadcn-starter/settings-secret/v1"

function getKey(): Buffer {
  if (!env.SETTINGS_SECRET) {
    throw new Error(
      "SETTINGS_SECRET non impostata: è necessaria per cifrare i segreti delle " +
        "impostazioni (es. la password SMTP). Generane una con " +
        "`openssl rand -base64 32` e mettila in .env (vedi .env.example)."
    )
  }
  return scryptSync(env.SETTINGS_SECRET, KEY_SALT, 32)
}

/** Cifra una stringa in chiaro e ritorna il payload `iv:authTag:dati` (base64). */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv, tag, data].map((b) => b.toString("base64")).join(":")
}

/** Decifra un payload prodotto da `encryptSecret`. Lancia se è corrotto o manomesso. */
export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(":")
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Segreto cifrato in formato non valido")
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivB64, "base64")
  )
  decipher.setAuthTag(Buffer.from(tagB64, "base64"))
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8")
}
