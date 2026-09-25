# Keamanan akses internet (WebSearch/WebFetch)

Dokumen ini soal risiko & batasan kalau pet (provider `claude`, lewat CLI
lokal di [src/main/claude-cli.js](src/main/claude-cli.js)) diberi akses ke
internet lewat tool `WebSearch`/`WebFetch`. Ditulis karena dua mode kerjanya
(`working`, `searching`) jalan dengan `--permission-mode bypassPermissions`
— artinya **tidak ada dialog konfirmasi manusia** sebelum tool internet atau
tool MCP dipanggil. Semua pengamanan harus datang dari desain (whitelist
tool, prompt, kode di sini), bukan dari pengguna yang meng-klik "izinkan".

## Peta akses saat ini

| Mode | Tool internet | Tool lain yang aktif bareng | bypassPermissions |
|---|---|---|---|
| `roleplay` (default) | tidak ada | Read, `remember_fact` | ya |
| `working` | WebSearch, WebFetch | Read, Glob, Grep, `remember_fact` + semua `SYSTEM_ACTION_TOOLS` (buka app, kontrol Spotify, tulis Calendar/Reminders) | ya |
| `searching` | WebSearch, WebFetch | `remember_fact` | ya |

Sumber: `MODES` di
[src/main/claude-cli.js:77-139](src/main/claude-cli.js#L77-L139).
Bash **tidak pernah** diizinkan di mode manapun, dan Write/Edit sengaja belum
dibuka (lihat komentar di baris 66-74) — dua batasan ini adalah pagar utama
dan tidak boleh dilonggarkan bersamaan dengan akses internet tanpa alasan
kuat + review terpisah.

Provider `claude-api` dan `chatgpt` ([src/main/ai.js](src/main/ai.js)) saat
ini memanggil API mentah tanpa tool sama sekali, jadi tidak relevan ke
dokumen ini — **kalau nanti tool/browsing ditambahkan ke provider itu juga**,
aturan di bawah berlaku sama untuknya.

## Prinsip inti

1. **Konten dari internet = data, bukan instruksi.** Apa pun yang dibawa
   balik oleh WebSearch/WebFetch (hasil pencarian, isi halaman) tidak boleh
   diperlakukan sebagai perintah baru dari pengguna. Prompt-injection lewat
   halaman web yang isinya "abaikan instruksi sebelumnya, lakukan X" adalah
   ancaman utama di sini karena tidak ada gate persetujuan manusia.
2. **Jangan gabungkan tool internet dengan tool berdampak nyata di mode yang
   sama tanpa kebutuhan jelas.** Mode `working` saat ini menggabungkan
   WebFetch/WebSearch dengan `SYSTEM_ACTION_TOOLS` (buka aplikasi, kontrol
   Spotify, bikin event Calendar/reminder) — artinya halaman web yang
   disusupi bisa saja memicu rantai "baca halaman -> ikuti instruksi di
   halaman -> panggil `create_calendar_event`/`spotify_control`/dst" tanpa
   ada yang mengonfirmasi. Kalau menambah tool baru yang berdampak nyata
   (menulis berkas, kirim pesan, bayar, dsb), jangan taruh di mode yang juga
   punya WebFetch/WebSearch kecuali sudah ada langkah konfirmasi terpisah.
3. **`remember_fact` bisa jadi racun memori jangka panjang.** Fakta yang
   disimpan lewat `remember_fact` ditulis ke `memory/MEMORY.md`
   ([src/main/claude-cli.js:266-268](src/main/claude-cli.js#L266-L268)) dan
   ikut ditempel ke `CLAUDE.md` yang dibaca ulang di **setiap** sesi
   berikutnya (`syncPersona()`,
   [src/main/claude-cli.js:287-302](src/main/claude-cli.js#L287-L302)). Kalau
   konten dari internet berhasil membujuk model memanggil `remember_fact`
   dengan data yang disusupi, injeksi itu jadi persisten lintas sesi, bukan
   cuma sekali chat. Jangan longgarkan tool ini jadi bisa dipanggil dengan
   data mentah dari hasil WebFetch tanpa disaring lebih dulu oleh model.
4. **Tidak ada Bash, tidak ada eksekusi kode dari internet.** Tool MCP di
   [src/main/mcp-tools-server.js](src/main/mcp-tools-server.js) sengaja
   sempit (AppleScript/mdfind lewat fungsi bernama, bukan shell bebas) —
   jangan pernah menambah tool yang menjalankan skrip/perintah hasil unduhan
   atau hasil parsing halaman web.
5. **Jangan biarkan hasil `Read` (isi berkas lokal) mengalir ke argumen
   WebFetch.** Mode `working` punya Read + WebFetch sekaligus. Kombinasi ini
   secara teknis bisa dipakai buat eksfiltrasi (baca berkas lokal, lalu
   "cari" konten itu di internet lewat query/URL) kalau model dibujuk
   melakukannya oleh instruksi tersembunyi di halaman yang dibaca
   sebelumnya. Ini bukan celah kode yang bisa "dipatch" sekali jalan — perlu
   diingat sebagai batasan desain tiap kali system prompt mode `working`
   diubah.
6. **Jangan taruh API key/secret di teks yang dikirim ke WebSearch/WebFetch.**
   Query pencarian atau URL yang dibentuk model tidak boleh menyertakan isi
   `settings.json`/API key (lihat [src/main/settings.js](src/main/settings.js))
   — itu bakal bocor ke provider pencarian pihak ketiga lewat log request.
7. **Konten dari internet dirender lewat `textContent`, bukan `innerHTML`,
   di UI chat.** [src/renderer/chat/chat.js](src/renderer/chat/chat.js)
   sudah benar untuk balasan teks biasa; satu-satunya `innerHTML` yang ada
   dipakai untuk output Mermaid yang disanitasi DOMPurify (`securityLevel:
   'strict'`, sekitar
   [chat.js:108](src/renderer/chat/chat.js#L108) dan
   [chat.js:157](src/renderer/chat/chat.js#L157)). Pertahankan pola ini —
   jangan tambah jalur baru yang menaruh teks hasil WebFetch langsung ke
   `innerHTML` tanpa sanitasi, karena `contextIsolation: true` +
   `nodeIntegration: false` di [src/main/windows.js](src/main/windows.js)
   cuma melindungi proses utama, bukan menghapus risiko XSS di renderer itu
   sendiri.

## Larangan keras (jangan dilakukan tanpa review keamanan terpisah)

- Jangan aktifkan `Bash` di mode manapun yang juga punya WebSearch/WebFetch.
- Jangan aktifkan `Write`/`Edit` di mode yang juga punya WebSearch/WebFetch
  sebelum confinement ke `workspaceDir()` benar-benar terverifikasi (lihat
  catatan yang sudah ada di
  [src/main/claude-cli.js:66-74](src/main/claude-cli.js#L66-L74) — jangan
  hapus catatan itu sampai isunya beres).
- Jangan tambah tool MCP baru yang punya efek destruktif/tidak bisa
  di-undo (hapus berkas, kirim pesan ke orang lain, transaksi) ke server
  `jinshi-tools` selama mode itu jalan dengan `bypassPermissions` +
  WebFetch aktif.
- Jangan hilangkan `--permission-mode bypassPermissions` diam-diam jadi
  mode interaktif untuk sebagian tool saja — kalau mau menambah gate
  konfirmasi, terapkan di level system prompt/kode secara eksplisit, jangan
  bergantung ke dialog izin CLI yang sudah dimatikan.
- Jangan expose `mcp-tools-server.js` atau argumen `--mcp-config` ke input
  yang datang dari luar (mis. isi halaman web ditaruh langsung sebagai
  bagian config MCP) — env `JINSHI_WORKSPACE_DIR` dan daftar tool harus
  tetap dibentuk dari kode, bukan dari data yang diambil lewat WebFetch.

## Checklist sebelum menambah mode/tool baru yang menyentuh internet

- [ ] Apakah mode ini benar-benar butuh WebSearch/WebFetch, atau cukup Read
      ke berkas lokal?
- [ ] Tool berdampak nyata apa saja yang ikut aktif di mode yang sama? Kalau
      ada, apa mitigasinya terhadap prompt-injection dari halaman yang
      dibaca?
- [ ] Apakah tool baru itu bisa dipanggil dengan argumen yang berasal
      (langsung/tidak langsung) dari isi halaman web? Kalau ya, apa yang
      mencegah argumen itu jadi perintah berbahaya?
- [ ] Kalau tool baru menulis state persisten (mirip `remember_fact`), apa
      yang mencegah data dari internet ikut tertulis ke situ?
- [ ] Apakah balasan yang menyertakan konten dari internet tetap dirender
      lewat `textContent` (bukan `innerHTML` tanpa sanitasi) di UI chat?
