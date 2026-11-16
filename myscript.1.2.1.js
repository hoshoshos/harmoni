<script type="text/JavaScript">
function renderRekap(res) {
  // proses card saldo
  const fragment = document.createDocumentFragment();
  const kasKontainer = document.getElementById('kasContainer');
  const StatusMap = {
    Aktif: { cls: 'bg-primary-subtle text-primary', prefix: 'aktif' },
    Arsip: { cls: 'bg-secondary-subtle text-secondary', prefix: 'arsip' }
  };
  let totSaldo = 0;  
  for (const item of res.cardKas) {
    totSaldo += Number(item.Saldo);
    const Cfg = StatusMap[item.Status];
    let id = Cfg ? `${Cfg.prefix}-${item.Kas.replace(/[^a-zA-Z0-9]/g, '')}` : '';
    let cls = Cfg ? Cfg.cls : 'bg-danger-subtle text-danger';
    const container = document.createElement('div');
    container.className = 'col-12 col-sm-6 col-md-4 col-lg-3 mb-3';
    container.innerHTML = `
    <div class="card text-light p-3 shadow-sm" id=${id}>
      <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-2">
        <span><i class="bi bi-tag-fill text-warning"></i>&nbsp; ${item.Kas === "Tabungan Kegiatan" ? "Tab. Kegiatan" : item.Kas}</span>
        <span class="badge small ${cls}">${item.Status}</span>
      </div>
      <h5 class="text-end fs-5 m-0">${formatRupiah(item.Saldo)}</h5>
    </div>`;
    fragment.append(container);
  }
  kasKontainer.append(fragment);
  document.getElementById('totalSaldo').textContent = formatRupiah(totSaldo);

  // proses tabel iuran
  let definisiKolom = [];
  let tempGroups = {};
  res.tblIuran.headers.forEach(h => {
    // jika kolom tunggal (No. atau Nama)
    if (h.main === '') {
      if (h.sub === 'No.') {
        definisiKolom.push({title:h.sub, field:h.field, headerSort:false, width:30, hozAlign:'right', frozen:true});
      } else if (h.sub === 'Nama') {
        definisiKolom.push({title:h.sub, field:h.field, headerSort:false, minWidth:80, widthGrow:1, hozAlign:'left', frozen:true});
      } else {
        definisiKolom.push({title:h.sub, field:h.field, headerSort:false, width:190, hozAlign:'left', frozen:false});
      }
    } else { // jika kolom bertingkat (Kekurangan, Agu 2026, Sep 2026, dst)
      if (!tempGroups[h.main]) {
        tempGroups[h.main] = {title:h.main, columns:[]};
        definisiKolom.push(tempGroups[h.main]);
      }
      tempGroups[h.main].columns.push({
        title:h.sub, field:h.field, hozAlign:'right', headerSort:false,
        //print:h.main === 'Total Kekurangan', htmlOutput:h.main === 'Total Kekurangan',
        width: h.sub === 'Bulanan' || h.sub === 'Jumlah' ? 80 : 110,
        minWidth: h.sub === 'Bulanan' || h.sub === 'Jumlah' ? 80 : 110,
        maxWidth: h.sub === 'Bulanan' || h.sub === 'Jumlah' ? 80 : 110,
        formatter:formatWarnaTagihan, formatterParams: {main:h.main, sub:h.sub}
      });
    }
  });

  allTbl.tblIuran.setColumns(definisiKolom);
  allTbl.tblIuran.setData(res.tblIuran.data);
}

function renderTblTransaksi(res) {
  document.getElementById('meetDate').textContent = res.Laporan.Meet;
  allTbl.tblLapIn.setData(res.Laporan.Pemasukan).then(function() {
    document.getElementById('saldoPemasukan').innerHTML = formatRupiah(allTbl.tblLapIn.getCalcResults().top.debet);
  });
  allTbl.tblLapOut.setData(res.Laporan.Pengeluaran).then(function() {
    document.getElementById('saldoPengeluaran').innerHTML = formatRupiah(allTbl.tblLapOut.getCalcResults().top.kredit);
  });

  for (const status in res.Histori) {
    const statusContainer = document.getElementById(`trans-${status}`);
    if (!statusContainer) continue;

    let arrKategori = Object.keys(res.Histori[status]);
    if (status === 'aktif') {
      arrKategori.sort((a,b) => {
        if (a === 'Bulanan') return -1;
        if (b === 'Bulanan') return 1;
        if (a === 'Jimpitan') return -1;
        if (b === 'Jimpitan') return 1;
        return 0;
      });
    } else { arrKategori.sort() }

    const fragment = document.createDocumentFragment();
    const tabulatorTasks = [];
    arrKategori.forEach((kat,idx) => {
      const idSaldo = `saldo${kat.replace(/[^a-zA-Z0-9]/g, '')}`;
      const idTable = `tbl${idx + kat.replace(/[^a-zA-Z0-9]/g, '')}`;
      const container = document.createElement('div');
      container.className = 'col';
      container.innerHTML = `
      <div class="card h-100">
        <div class="card-header">
          <h5 class="d-flex align-items-center justify-content-between flex-wrap m-0">
            <div class="d-flex align-items-center"><i class="bi bi-tag-fill text-warning"></i>&nbsp;${kat === 'Tabungan Kegiatan' ? 'Tab. Kegiatan' : kat}</div>
            <span id="${idSaldo}" class="badge text-light border shadow-sm fs-6 mt-1 mt-sm-0">0</span>
          </h5>
        </div>
        <div class="card-body p-0">
          <div class="form-switch d-flex align-items-center gap-2 m-2" style="font-size:.75rem;">
            <input class="form-check-input toggle-calcs mt-0" type="checkbox" role="switch" id="switch${idTable}">
            <label class="form-check-label" for="switch${idTable}">Tampilkan total</label>
          </div>
          <div id="${idTable}"></div>
        </div>
      </div>`;
      fragment.append(container);
      tabulatorTasks.push({kat,idTable,idSaldo});
    });
    statusContainer.append(fragment);

    tabulatorTasks.forEach(task => {
      allTbl[task.idTable] = new Tabulator(`#${task.idTable}`, {
        data:res.Histori[status][task.kat], layout:'fitColumns',
        locale:'en', pagination:'local', paginationSize:7,
        movableColumns:false, columnDefaults:{resizable:false},
        initialSort:[{column:'id', dir:'desc'}],
        columns:[
          {title:'No', field:'id', sorter:'number', visible:false},
          {title:'Tanggal', field:'tanggal', width:80, headerSort:false, frozen:true, hozAlign:'center'},
          {
            title:'Keterangan', field:'keterangan', headerSort:false, minWidth:250, maxWidth:800, widthGrow:1, resizable:true,
            formatter: function(cell) {
              const rowData = cell.getRow().getData();
              const ikon = rowData.url !== '-' ? 
              `<i class="bi bi-paperclip text-success ms-2" style="font-size:1rem;" title="Lihat Berkas" data-bs-toggle="modal" data-bs-target="#modalBerkas" data-id="${rowData.url}" data-txt="${rowData.keterangan}"></i>` 
              : '';
              return `<span>${rowData.keterangan}</span> ${ikon}`;
            }
          },
          {title:'Debet', field:'debet', headerSort:false, width:100, topCalc:'sum', hozAlign:'right',
          topCalcFormatter:(cell) => formatRupiah(cell.getValue()),
          formatter:(cell) => (cell.getValue() && cell.getValue() !== '-') ? `<span class="text-success">${formatRupiah(cell.getValue())}</span>` : '-'
          },
          {title:'Kredit', field:'kredit', headerSort:false, width:100, topCalc:'sum', hozAlign:'right',
          topCalcFormatter:(cell) => formatRupiah(cell.getValue()),
          formatter:(cell) => (cell.getValue() && cell.getValue() !== '-') ? `<span class="text-danger">${formatRupiah(cell.getValue())}</span>` : '-'
          }
        ]
      });
      allTbl[task.idTable].on('tableBuilt', function() {
        const calc = this.getCalcResults();
        const debet = (calc.top && calc.top.debet) ? Number(calc.top.debet) : 0;
        const kredit = (calc.top && calc.top.kredit) ? Number(calc.top.kredit) : 0;
        const saldo = debet - kredit;
        const elSaldo = document.getElementById(task.idSaldo);
        if (elSaldo) elSaldo.innerHTML = `<span class="fw-semibold">${formatRupiah(saldo)}</span>`;
      });
    });
  }
}

function renderTblJimpitan(isNew,res) {
  let colDef = res.headers.map(function(col) {
    let config = {title:col, field:col, headerSort:false, hozAlign:'center'};
    if (col === 'Tanggal') {
      Object.assign(config, {frozen:true, hozAlign:'left'});
      // tambahkan nama hari
      config.formatter = function(cell) {
        let val = cell.getValue(); // 01-05-2026
        if (val && val.includes('-')) {
          let tgl = val.split('-');
          let objDate = new Date(tgl[2], parseInt(tgl[1],10)-1, tgl[0]);
          let namaHari = DaftarHariMin[objDate.getDay()];
          return `${namaHari}, ${val}`;
        }
        return val;
      };
    }
    return config;
  });

  if (isNew) allTbl.tblJimpitan.setColumns(colDef);
  allTbl.tblJimpitan.replaceData(res.data.reverse())
  .then(() => Notif.fire({icon:'success', text:`Berhasil ${isNew?'mengambil':'memperbarui'} data.`}))
  .catch((err) => Notif.fire({icon:'error', text:err}));

  // generate menu di checkbox warga
  const fragment = document.createDocumentFragment();
  const listChkJimpitan = document.getElementById('daftar-checkbox-kolom');
  listChkJimpitan.innerHTML = ''; 

  allTbl.tblJimpitan.getColumns().forEach(function(col) {
    let colName = col.getDefinition().title;
    if (colName === 'Tanggal') return; // kolom Tanggal wajib tampil
    let chk = document.createElement('input');
    Object.assign(chk, {type:'checkbox', checked:col.isVisible()});
    chk.style.marginRight = '8px';
    chk.addEventListener('change', () => {
      col.toggle();
      allTbl.tblJimpitan.redraw(true);
    });

    let lbl = document.createElement('label');
    Object.assign(lbl.style, {display:'block', margin:'5px 0', cursor:'pointer'});
    lbl.append(chk, colName);
    fragment.append(lbl);
  });
  listChkJimpitan.append(fragment);

  const btnBerkasJimpitan = document.getElementById('btn-berkas-jimpitan');
  btnBerkasJimpitan.innerHTML = '';
  res.embed.forEach(function(url,idx) {
    const lbl = `Formulir ${idx+2026}`;
    let btn = document.createElement('button');
    btn.className = 'btn btn-sm btn-outline-primary';
    btn.type = 'button';
    btn.title = 'Lihat Berkas';
    btn.textContent = lbl;
    btn.dataset.bsToggle = 'modal';
    btn.dataset.bsTarget = '#modalBerkas';
    btn.dataset.id = url;
    btn.dataset.txt = lbl;
    fragment.append(btn);
  });
  btnBerkasJimpitan.append(fragment);
}

function loadRekap() {
  let btn = document.getElementById('btnMuat');
  btn.disabled = true;
  btn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
  ambilDataServer('getRekap')
  .then((res) => {
    document.getElementById('kasContainer').innerHTML = '';
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
    Notif.fire({icon:'success', text:'Berhasil mengambil data.'});
    renderRekap(res);
  })
  .catch((err) => {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
    Swal.fire({
      icon:'error', title:'Error', text:err.message || err,
      confirmButtonText:'OK', allowOutsideClick:false
    });
  });
}

function loadTransaksi() {
  let btn = document.getElementById('btnMuat');
  btn.disabled = true;
  btn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
  ambilDataServer('getTransaksi')
  .then((res) => {
    document.getElementById('trans-aktif').innerHTML = '';
    document.getElementById('trans-arsip').innerHTML = '';
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
    Notif.fire({icon:'success', text:'Berhasil mengambil data.'});
    renderTblTransaksi(res);
  })
  .catch((err) => {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
    Swal.fire({
      icon:'error', title:'Error', text:err.message || err,
      confirmButtonText:'OK', allowOutsideClick:false
    });
  });
}

function loadJimpitan(isNew) {
  let btn = document.getElementById('btnMuat');
  btn.disabled = true;
  btn.innerHTML = '<i class="bi bi-hourglass-split"></i>';

  ambilDataServer('getJimpitan')
  .then((res) => {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
    if(!res.message) {
      renderTblJimpitan(isNew,res)
      Notif.fire({icon:'success', text:'Berhasil mengambil data.'});
    }
    else {
      Swal.fire({icon:'warning', title:'Warning', text:res.message, confirmButtonText:'OK'});
    }
  })
  .catch((err) => {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
    Swal.fire({
      icon:'error', title:'Error', text:err.message || err,
      confirmButtonText:'OK', allowOutsideClick:false
    });
  });
}

function pageRekap() {
  if(!document.getElementById('kasContainer') || !document.getElementById('tbl-iuran')) return;
  allTbl.tblIuran = new Tabulator('#tbl-iuran', {
    data:[], layout:'fitColumns', movableColumns:false, columnDefaults:{resizable:false},
    nestedFieldSeparator:false, columnHeaderVertAlign:'middle',
    columnDefaults: {headerHozAlign:'center'}, printAsHtml:true, printStyled:true,
  });
  loadRekap();
}

function pageTransaksi() {
  if(
    !document.getElementById('tbl-lapin') ||
    !document.getElementById('tbl-lapout') ||
    !document.getElementById('transaksi') ||
    !document.getElementById('trans-aktif') ||
    !document.getElementById('trans-arsip')
  ) return;

  const tblConfig = {
    data:[], layout:'fitColumns', movableColumns:false, columnDefaults:{resizable:false}, locale:'en', pagination:'local', paginationSize:7
  }
  const kolomAwal = [
    {title:'Tanggal', field:'tanggal', width:80, headerSort:false, frozen:true, hozAlign:'center'},
    {
      title:'Keterangan', field:'keterangan', headerSort:false, minWidth:200, maxWidth:800, widthGrow:1, resizable:true,
      formatter: function(cell) {
        const rowData = cell.getRow().getData();
        const ikon = rowData.url !== '-' ? 
        `<i class="bi bi-paperclip text-success ms-2" style="font-size:1rem;" title="Lihat Berkas" data-bs-toggle="modal" data-bs-target="#modalBerkas" data-id="${rowData.url}" data-txt="${rowData.keterangan}"></i>` 
        : '';
        return `<span>${rowData.keterangan}</span> ${ikon}`;
      }
    }
  ];
  const kolomAkhir = [
    {title:'Kas', field:'kategori', headerSort:false, width:100}
  ];
  
  allTbl.tblLapIn = new Tabulator('#tbl-lapin', {
    ...tblConfig, columns: [...kolomAwal, {
      title:'Nominal', field:'debet', headerSort:false, width:100, hozAlign:'right', topCalc:'sum',
      formatter:(cell) => formatRupiah(cell.getValue()),
      topCalcFormatter:(cell) => formatRupiah(cell.getValue())
    }, ...kolomAkhir]
  });
  
  allTbl.tblLapOut = new Tabulator('#tbl-lapout', {
    ...tblConfig, columns: [...kolomAwal, {
      title:'Nominal', field:'kredit', headerSort:false, width:100, hozAlign:'right', topCalc:'sum',
      formatter:(cell) => formatRupiah(cell.getValue()),
      topCalcFormatter:(cell) => formatRupiah(cell.getValue())
    }, ...kolomAkhir]
  });

  loadTransaksi();
}

function pageJimpitan() {
  if(!document.getElementById('tbl-jimpitan')) return;
  
  allTbl.tblJimpitan = new Tabulator('#tbl-jimpitan', {
    data:[], height:'720px', layout:'fitDataFill', movableColumns:false, columnDefaults:{resizable:false},
    groupBy:function(data) {
      // 01-05-2026
      if (data.Tanggal && data.Tanggal.includes('-')) {
        let tgl = data.Tanggal.split('-');
        return `${DaftarBulan[parseInt(tgl[1],10)-1]} ${tgl[2]}`;
      }
      return 'Lainnya';
    },
    groupHeader:(val,count) => `<span>🗓️ ${val}</span><span style="font-size: 10px;">(${count} hari)</span>`
  });
  allTbl.tblJimpitan.on('renderComplete', () => {
    let kolomAktif = allTbl.tblJimpitan.getColumns()
    .filter(c => c.isVisible() && c.getDefinition().title !== 'Tanggal')
    .map(c => c.getField());

    let totalKosong = 0;
    allTbl.tblJimpitan.getData('active').forEach(row => {
      kolomAktif.forEach(field => {
        let nilaiCell = row[field];
        if (nilaiCell === '⚠️') totalKosong++;
      });
    });
    document.getElementById('jimpitanKosong').textContent = totalKosong;
  });

  loadJimpitan(true);
}

function pindahHalaman(namaFileMenu,fungsiInit,elemenKlik) {
  Swal.fire({
    html:`<div class="mt-2 text-muted">Memuat <strong>${namaFileMenu}</strong>, mohon tunggu.</div>`,
    allowOutsideClick:false, allowEscapeKey:false, focusConfirm:false, showConfirmButton:false,
    didOpen:()=>{Swal.showLoading()}
  });

  // Cek apakah menu di HP sedang terbuka (Bootstrap menandainya dengan kelas "show")
  let panelMenu = document.getElementById('navbarNav');
  let tombolToggler = document.querySelector('.navbar-toggler');
  if (panelMenu && panelMenu.classList.contains('show') && tombolToggler) {tombolToggler.click()}

  Object.keys(allTbl).forEach(key => {
    allTbl[key]?.destroy?.();
    allTbl[key] = null;
  });

  if (elemenKlik) {
    document.querySelectorAll('.nav-link-menu').forEach(function(menu) {
      menu.classList.remove('text-white'); menu.classList.add('text-white-50');
    });
    elemenKlik.classList.remove('text-white-50'); elemenKlik.classList.add('text-white');
  }

  google.script.run
  .withSuccessHandler(function(resHTML) {
    document.querySelector('main#konten-utama').innerHTML = resHTML;
    Swal.close();
    setTimeout(function() {
      if (fungsiInit && typeof window[fungsiInit] === 'function') window[fungsiInit]();
    },100);
  })
  .withFailureHandler(function(err) {
    Swal.fire({icon:'error', title:'Gagal Memuat', text: err.message, confirmButtonText:'OK'});
  })
  .include(namaFileMenu);
}

function ambilDataServer(fname,params=[],durasi=20) {
  return new Promise((resolve,reject) => {
    let sisaWaktu = durasi;
    let countdownTimer;
    let appStatus = 'memuat';

    Swal.fire({
      html:`
      <div class="my-3">
        <div class="spinner-border text-primary mb-3" role="status" style="width: 3rem; height: 3rem;"></div>
        <p class="text-secondary fw-semibold mb-1">Mengambil Data</p>
        <div class="badge bg-light text-secondary border p-2 fs-6 mt-2">
          <i class="bi bi-stopwatch"></i>&nbsp;<span id="swal-countdown" class="text-danger fw-bold">${sisaWaktu}</span> detik
        </div>
      </div>`,
      allowOutsideClick:false, allowEscapeKey:false, showConfirmButton:false,
      didOpen: () => {
        countdownTimer = setInterval(() => {
          sisaWaktu--;
          const elCountdown = document.getElementById('swal-countdown');
          if (elCountdown) elCountdown.textContent = sisaWaktu;
          if (sisaWaktu <= 0) {
            clearInterval(countdownTimer);
            if (appStatus === 'memuat') {
              appStatus = 'timeout';
              Swal.close();
              reject(new Error(`Koneksi terputus atau respons terlalu lama (${durasi} detik).`));
            }
          }
        },1000);
      },
      willClose: () => clearInterval(countdownTimer)
    });

    // Eksekusi Dinamis google.script.run berdasarkan teks string nama fungsi
    const runner = google.script.run
    .withSuccessHandler(function(res) {
      clearInterval(countdownTimer);
      if (appStatus === 'timeout') return; 
      appStatus = 'sukses';
      Swal.close();
      resolve(res);
    })
    .withFailureHandler(function(err) {
      clearInterval(countdownTimer);
      if (appStatus === 'timeout') return;
      appStatus = 'gagal';
      Swal.close();
      reject(err);
    });
    runner[fname].apply(null, params);
  });
}

window.addEventListener('DOMContentLoaded', function() {
  prosesLog();

  const kontenUtama = document.querySelector('main#konten-utama');
  kontenUtama.addEventListener('change', function(e) {
    // Cek apakah yang diubah adalah switch dengan class 'toggle-calcs'
    if (e.target && e.target.classList.contains('toggle-calcs')) {
      const cardBody = e.target.closest('.card-body');
      if (cardBody) {
        cardBody.classList.toggle('show-total', e.target.checked);
      }
    }
  });

  const modalBerkas = document.getElementById('modalBerkas');
  if (modalBerkas) {
    modalBerkas.addEventListener('show.bs.modal', function (event) {
      const idDrive = event.relatedTarget.getAttribute('data-id');
      const title = modalBerkas.querySelector('#titleBerkas');
      const iframe = modalBerkas.querySelector('#modalFrame');
      
      if (idDrive && title && iframe) {
        title.textContent = event.relatedTarget.getAttribute('data-txt');
        iframe.src = `https://drive.google.com/file/d/${idDrive}/preview`;
      }
    });
    modalBerkas.addEventListener('hidden.bs.modal', function () {
      const title = modalBerkas.querySelector('#titleBerkas');
      const iframe = modalBerkas.querySelector('#modalFrame');
      if (title && iframe) {
        title.textContent = 'Pratinjau';
        iframe.src = '';
      }
    });
  }

  pindahHalaman('Rekap','pageRekap');
});
</script>
