/**
 * PROFIL-CONFIG.JS — konfigurasi fitur Profil Kegiatan (fase development).
 * getDataFlowUrl: flow GetMasterData yang SUDAH ADA (hanya dibaca; sama dengan halaman produksi).
 * saveFlowUrl   : flow BARU "SimpanProfil" (lihat docs/FLOW_SimpanProfil.md). Kosongkan sampai flow dibuat.
 * readFlowUrl   : flow BARU "BacaProfil" (Fase 3, docs/FLOW_SimpanProfil.md bagian 7).
 */
window.PROFIL_CONFIG = {
    getDataFlowUrl: 'https://default7a697bb285cb4005b6b2f0bda687be.52.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/adaa001b7e3843219b41e66e7a033049/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=K14G3WH5mC6A8ljNyPnKBwPq5ZIz4CX06ZqEesR220k',
    saveFlowUrl: 'https://default7a697bb285cb4005b6b2f0bda687be.52.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/10/workflows/7c198e8aa1164a959b514ae97a11d249/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=t7n0RC3VAuQTUrRiCeXF_9kBnw9B34b0Hr0iZvIGpgw',
    readFlowUrl: 'https://default7a697bb285cb4005b6b2f0bda687be.52.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/00/workflows/8819579a540242c496e61e2b28fcf044/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=e4ZxeF1q-v7QyLKlnM_dZqqlSovshacXyiF1mEsRjhk',       // flow BARU "BacaProfil" (profil dasar + aset + laporan terakhir); kosong = profil dasar diisi manual
    maxPayloadMB: 50,      // batas praktis flow perlu diuji; turunkan bila flow menolak file besar
    timeoutMs: 180000,
    pembuatList: ['Teuku Zaqirul Haq', 'Muhamad Adryan Arif F.', 'Lundu Sihombing', 'Abdi Nagara', 'Muarif', "Halimatusa'adiyah Anar", 'Ryngga Dedy Andyka', 'Kiki Adhi Prasetyo', 'Dian Puspitasari', 'M. Naufal Ammar N.']
};
