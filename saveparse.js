// Parser de saves USR-DATA — The Last of Us Part I (PC)
// Formato documentado em SaveAnalyser/FORMAT.md (análise reversa de saves reais).
// 100% client-side: nenhum byte sai do navegador.

const TLOUSave = (() => {
  const OFF_TITLE = 0x10;
  const OFF_SUBTITLE = 0x90;
  const OFF_ICON = 0x510;
  const OFF_BLOCKLEN = 0x598;
  const OFF_DETAIL = 0x5a4;
  const STATE_START = 0x9a8;
  const REGISTRY_LO = 0x1f0000;
  const REGISTRY_HI = 0x260000;

  // sid (FNV-1a-64 hex) → rótulo amigável — do item_names.json do SaveAnalyser
  const ITEM_LABELS = {
    "0104091a0ade59c5": "Peças (engrenagens)",
    "abe4a656ca19db60": "Suplementos (pílulas)",
    "aa58733cfd389afc": "Nível de ferramenta",
    "7133e37e5885c210": "Upgrade de canivete",
    "1ea95d464b68c80a": "Kit de saúde",
    "d59ffe43ad1b4396": "Pistola 9mm",
    "9f56aeadc8d6a4f2": "Revólver",
    "6cc9979fbda34c31": "Shorty",
    "7d25069192fd246a": "Shotgun",
    "e3353adaf94073cf": "Rifle de ferrolho",
    "5f945ef0eb10030b": "Arco",
    "632e318bf2646ec5": "Rifle de assalto",
    "dea3f3d75f309fd0": "Tábua 2x4",
    "a855deeb28acbed9": "Molotov",
    "1d22d8fe18c9aa9d": "Bomba de fumaça",
    "edd5d8908d682d9a": "Tijolo",
    "91485dae62f322a9": "Garrafa",
    "482c6a557353fa5d": "Álcool",
    "e93dfef138c585c1": "Pano",
    "a98b958bc05e1da2": "Fita adesiva",
    "4006421e254c7891": "Lâmina",
    "995081d9b5b7eef4": "Explosivo",
    "355f7b26b69abf05": "Açúcar",
    "b4ce74acb1317617": "Munição 9mm",
    "dde675074fc76559": "Munição revólver",
    "afdab42da5eaf722": "Munição Shorty",
    "d40070113c4fc14c": "Munição shotgun",
    "e908b9ecc7744100": "Munição rifle",
    "9265cc580d411f4a": "Munição rifle de assalto",
    "1f586b9100862fcb": "Flechas",
    "4226188df8bb50f0": "Combustível lança-chamas",
  };

  // Manuais de treinamento — sid do registro → nome do item no checklist
  const MANUALS = {
    "24670881921cb02b": "Shiv: Sharpening",
    "24670981921cb1de": "Shiv: Reinforcement",
    "5a9cdf3c6570cfd0": "Health: Splinting",
    "5a9ce23c6570d4e9": "Health: Sterilization",
    "c19ca516471e5970": "Melee: Knots",
    "c19ca816471e5e89": "Melee: Techniques",
    "6e7c99658180dc93": "Molotov: Construction",
    "6e7c9a658180de46": "Molotov: Deployment",
    "921388102b31844b": "Bomb: Containment",
    "921389102b3185fe": "Bomb: Shrapnel",
    "72cfa56ec49dc02f": "Smoke: Shaping",
    "72cfa66ec49dc1e2": "Smoke: Chemistry",
  };

  const TOOLS = {
    "9647115aeb40ab24": "Plier",
    "9647145aeb40b03d": "Filer",
    "9647135aeb40ae8a": "Cleaning Rod",
    "96470e5aeb40a60b": "Wrench",
    "96470d5aeb40a458": "Pin Punch",
  };

  const DIFFICULTIES = [
    "DIFFICULTY_EASY",
    "DIFFICULTY_NORMAL",
    "DIFFICULTY_HARD",
    "DIFFICULTY_SURVIVOR",
    "DIFFICULTY_GROUNDED",
  ];

  function fnv1a64(str) {
    let h = 0xcbf29ce484222325n;
    for (const b of new TextEncoder().encode(str)) {
      h ^= BigInt(b);
      h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
    }
    return h;
  }

  function readCStr(view, off, maxLen) {
    const bytes = new Uint8Array(view.buffer, view.byteOffset + off, maxLen);
    let end = 0;
    while (end < maxLen && bytes[end] !== 0) end++;
    return new TextDecoder("utf-8").decode(bytes.subarray(0, end));
  }

  function parseTag(raw) {
    const m = raw.match(/\[([0-9A-Fa-f]{24})\]/);
    if (!m) return null;
    const bytes = new Uint8Array(12);
    for (let i = 0; i < 12; i++) bytes[i] = parseInt(m[1].slice(i * 2, i * 2 + 2), 16);
    const dv = new DataView(bytes.buffer);
    return {
      chapterIndex: bytes[1],
      collectedTotal: dv.getUint16(6, false),
      playtimeSeconds: dv.getUint32(8, false),
    };
  }

  function scanInventory(view, lo, hi) {
    const out = [];
    const seen = new Set();
    for (let i = lo; i + 0x30 < hi; i += 8) {
      const sid = view.getBigUint64(i, true);
      if (sid < 0x1000000000000n || sid > 0xf000000000000000n) continue;
      const val = view.getBigUint64(i + 0x10, true);
      const marker = view.getBigUint64(i + 0x20, true);
      if (val < 1n || val > 200n) continue;
      if ((marker & 0xffffffffn) !== 0x1010101n) continue;
      const hex = sid.toString(16).padStart(16, "0");
      if (seen.has(hex)) continue;
      seen.add(hex);
      out.push({ sid: hex, value: Number(val), offset: i });
    }
    return out;
  }

  function parse(buf, fileName) {
    if (buf.byteLength < 0x9a8)
      throw new Error("arquivo pequeno demais para ser um save TLOU1");
    const view = new DataView(buf);

    const title = readCStr(view, OFF_TITLE, 0x80);
    if (!/Last of Us/i.test(title))
      throw new Error("não é um save de The Last of Us (assinatura não encontrada)");
    const game = /Part II/i.test(title) ? "part2" : "part1";
    if (game === "part2")
      throw new Error(
        "save de The Last of Us Part II detectado — o parser atual cobre apenas Part I (PC)"
      );

    const subtitle = readCStr(view, OFF_SUBTITLE, 0x80);
    const icon = readCStr(view, OFF_ICON, 0x40);
    const isProfile = /perfil|profile/i.test(subtitle);
    const saveType = isProfile
      ? "perfil"
      : /AUTOM[AÁ]TICO/i.test(subtitle)
        ? "automático"
        : /BACKUP/i.test(subtitle)
          ? "backup"
          : /Jogo salvo/i.test(subtitle)
            ? "manual"
            : null;

    let detailEnd = STATE_START;
    for (let i = OFF_DETAIL; i + 8 <= STATE_START; i += 8) {
      if (view.getBigUint64(i, true) === 0n) {
        detailEnd = i;
        break;
      }
    }
    const detail = readCStr(view, OFF_DETAIL, detailEnd - OFF_DETAIL);
    const lines = detail.split("\n").map((s) => s.trim()).filter(Boolean);

    let difficulty = null,
      playtimeText = null,
      collectedFromText = null,
      ngPlus = null;
    for (const line of lines) {
      const dm = line.match(/desafio\s+(.+)/i);
      if (dm) difficulty = dm[1].trim();
      if (/\d+\s*h\b|\d+\s*hora|\d+\s*min/i.test(line)) playtimeText = line;
      const ng = line.match(/novo jogo\s*\+\s*(?:\(([^)]*)\))?/i);
      if (ng) ngPlus = `Novo Jogo +${ng[1] ? ` (${ng[1].trim()})` : ""}`;
      const cm = line.match(/(\d+)\s*(colecion|collectib)/i);
      if (cm) collectedFromText = parseInt(cm[1], 10);
    }
    const chapter =
      lines.find(
        (l) =>
          !/desafio/i.test(l) &&
          l !== playtimeText &&
          !/\d+\s*(colecion|collectib)/i.test(l) &&
          !l.startsWith("[")
      ) || null;

    if (difficulty?.endsWith("+") && !ngPlus) ngPlus = "Novo Jogo +";

    const tag = parseTag(detail);
    const collectedTotal = tag?.collectedTotal ?? collectedFromText;
    const completed =
      /CONCLU[IÍ]DO/i.test(chapter || "") || tag?.chapterIndex === 0x1c;

    // índice u64 de todo o estado (fora do registro estático 0x1F0000–0x260000)
    const allU64 = new Set();
    for (let i = STATE_START; i + 8 <= buf.byteLength; i += 8) {
      if (i >= REGISTRY_LO && i < REGISTRY_HI) {
        i = REGISTRY_HI - 8;
        continue;
      }
      allU64.add(view.getBigUint64(i, true).toString(16).padStart(16, "0"));
    }

    const inventory = scanInventory(
      view,
      STATE_START,
      Math.min(REGISTRY_LO, buf.byteLength - 8)
    ).map((e) => ({
      ...e,
      label: ITEM_LABELS[e.sid] || MANUALS[e.sid] || null,
    }));

    const manualsFound = Object.keys(MANUALS)
      .filter((sid) => allU64.has(sid))
      .map((sid) => ({ sid, name: MANUALS[sid] }));

    const toolsFound = Object.keys(TOOLS).filter((sid) => allU64.has(sid));
    const toolLevelEntry = inventory.find(
      (e) => e.sid === "aa58733cfd389afc"
    );
    const toolLevel = toolLevelEntry ? toolLevelEntry.value : 0;

    let difficultySid = null;
    for (const d of DIFFICULTIES) {
      if (allU64.has(fnv1a64(d).toString(16).padStart(16, "0"))) {
        difficultySid = d;
        break;
      }
    }

    return {
      fileName,
      fileSize: buf.byteLength,
      game,
      saveType,
      isProfile,
      subtitle: subtitle.trim(),
      icon: icon.trim(),
      chapter,
      chapterIndex: tag?.chapterIndex ?? null,
      completed,
      ngPlus,
      difficulty,
      playtimeText,
      playtimeSeconds: tag?.playtimeSeconds ?? null,
      collectedTotal,
      inventory,
      manualsFound,
      toolsFound,
      toolLevel,
      difficultySid,
      detailText: detail,
    };
  }

  return { parse, MANUALS, ITEM_LABELS };
})();
