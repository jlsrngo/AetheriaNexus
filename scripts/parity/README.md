# Parity harness (OpenCode ↔ Aetheria)

Menjalankan engine Aetheria terhadap provider palsu yang skripnya deterministik, lalu
mencocokkan perilakunya dengan 57 skenario di `docs/llm_parity_opencode_vs_aetheria.md` §13.

## Perintah

```bash
npm run test:parity:self          # uji harness sendiri, tanpa engine (25 assert)
npm run test:parity               # spawn engine terisolasi, jalankan 57 skenario
npm run test:parity -- --only K01,K08
node scripts/parity/run-conformance.mjs --engine http://127.0.0.1:4196   # attach
npm run test:parity:golden              # record OpenCode oracle
node scripts/parity/run-conformance.mjs --golden scripts/parity/golden
```

Default memakai `e2e/live-stack.mjs`: HOME sementara, `aetheria.json` sendiri yang menunjuk
ke fake provider, engine di `127.0.0.1:4196`, Vite tidak dijalankan. Butuh binary engine
(`target/debug`/`target/release`).

Mode `--engine` memakai engine yang sudah hidup (kredensial dari env
`AETHERIA_SERVER_USERNAME`/`AETHERIA_SERVER_PASSWORD` atau `~/.aetheria/dev-server-password`);
runner mencetak potongan config provider yang harus ditambahkan ke `aetheria.json`.

## Arti hasil

- Skor = `lulus / 57`. Skenario `implemented: false` **dihitung gagal**, tidak pernah di-skip.
- Tanpa `--golden`, ekspektasi diturunkan dari spesifikasi, jadi hasilnya **self-check engine**.
- `npm run test:parity:golden` merekam OpenCode ke `golden/`; perintah butuh Bun, checkout OpenCode, dan dependensi OpenCode terpasang.
- Dengan `--golden <dir>`, runner membandingkan event + request aktual secara exact setelah normalisasi. Golden tidak mengisi skenario `NOT_IMPLEMENTED` sebagai bukti lulus.
- Exit code 0 hanya bila 57/57.

## Artefak

| Path | Isi |
|---|---|
| `report/score.txt` | label oracle + skor run terakhir |
| `report/failures.ndjson` | satu baris per tes gagal (`status`, `detail`) |
| `report/engine.log` | stdout/stderr engine selama run (mode spawn) |
| `actual/K*.ndjson` | event ternormalisasi + request provider per tes |

`actual/` dan `report/` tidak di-commit; hapus kapan saja, runner membuatnya lagi.
