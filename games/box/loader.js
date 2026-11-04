(function () {
  var VERSION = 'da30c07b3551';
  var ENGINE = 'boxweb';
  var WASM_SIZE = 9146622;
  var script = document.currentScript;
  var base = script.src.substring(0, script.src.lastIndexOf('/') + 1);
  var game = window.BOX_GAME;

  var canvas = document.getElementById('canvas');
  var overlay = document.getElementById('overlay');
  var message = document.getElementById('message');
  var detail = document.getElementById('detail');
  var bar = document.getElementById('bar');
  var fill = bar.firstElementChild;

  function fail(text, note) {
    overlay.classList.remove('hidden');
    bar.classList.add('hidden');
    message.textContent = text;
    detail.innerHTML = note || '';
  }

  var total = WASM_SIZE;
  game.files.forEach(function (f) { total += f.size; });
  var received = 0;
  var shown = 0;
  function progress(n) {
    received += n;
    var frac = Math.min(received / total, 1) * 0.9;
    if (frac > shown) {
      shown = frac;
      fill.style.transform = 'scaleX(' + frac.toFixed(4) + ')';
      detail.textContent = Math.round(frac / 0.9 * 100) + '%';
    }
  }

  function download(url, size) {
    return fetch(url, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) {
        throw new Error(url + ': HTTP ' + r.status);
      }
      if (!r.body) {
        return r.arrayBuffer().then(function (b) { progress(size); return b; });
      }
      var reader = r.body.getReader();
      var chunks = [];
      var length = 0;
      function pump() {
        return reader.read().then(function (res) {
          if (res.done) {
            var out = new Uint8Array(length);
            var at = 0;
            chunks.forEach(function (c) { out.set(c, at); at += c.byteLength; });
            return out.buffer;
          }
          chunks.push(res.value);
          length += res.value.byteLength;
          progress(res.value.byteLength);
          return pump();
        });
      }
      return pump();
    });
  }

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = url;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Cannot load ' + url)); };
      document.head.appendChild(s);
    });
  }

  if (!navigator.gpu) {
    fail('This game needs a WebGPU-capable browser.',
      'Try a recent <b>Chrome</b>, <b>Edge</b> or <b>Safari</b>.');
    return;
  }

  message.textContent = 'Downloading…';

  var wasm = download(base + ENGINE + '.wasm?v=' + VERSION, WASM_SIZE)
    .then(function (bytes) { return WebAssembly.compile(bytes); });
  var engine = loadScript(base + ENGINE + '.js?v=' + VERSION);
  var files = Promise.all(game.files.map(function (f) {
    return download(f.path, f.size).then(function (data) {
      return { path: f.path, data: new Uint8Array(data) };
    });
  }));
  var device = navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })
    .then(function (adapter) {
      if (!adapter) {
        throw new Error('No WebGPU adapter.');
      }
      var features = adapter.features.has('timestamp-query') ? ['timestamp-query'] : [];
      return adapter.requestDevice({
        requiredFeatures: features,
        requiredLimits: { maxTextureArrayLayers: adapter.limits.maxTextureArrayLayers }
      });
    });

  wasm.catch(function () {});
  files.catch(function () {});
  device.catch(function () {});

  canvas.addEventListener('pointerdown', function () { canvas.focus(); });

  Promise.all([wasm, engine, files, device]).then(function (r) {
    var module = r[0];
    var data = r[2];
    var gpu = r[3];
    fill.style.transform = 'scaleX(0.95)';
    message.textContent = 'Building the world…';
    detail.textContent = '';
    gpu.lost.then(function (info) {
      if (info.reason !== 'destroyed') {
        fail('The WebGPU device was lost.', info.message);
      }
    });
    var args = [game.scene];
    if (location.hash.length > 1) {
      decodeURIComponent(location.hash.slice(1)).split(' ').forEach(function (a) {
        if (a.length) {
          args.push(a);
        }
      });
    }
    var options = {
      canvas: canvas,
      preinitializedWebGPUDevice: gpu,
      arguments: args,
      print: function (t) { console.log(t); },
      printErr: function (t) { console.error(t); },
      instantiateWasm: function (imports, ready) {
        WebAssembly.instantiate(module, imports).then(function (inst) {
          ready(inst, module);
        }, function (err) {
          fail('Failed to load the engine.', String(err && err.message || err));
        });
        return {};
      },
      preRun: [function (m) {
        var fs = (m && m.FS) || options.FS;
        data.forEach(function (f) {
          var dir = f.path.substring(0, f.path.lastIndexOf('/'));
          if (dir) {
            fs.mkdirTree(dir);
          }
          fs.writeFile(f.path, f.data);
        });
      }]
    };
    return window[ENGINE](options);
  }).then(function (Module) {
    window.Module = Module;
    fill.style.transform = 'scaleX(1)';
    overlay.classList.add('hidden');
    canvas.focus();
  }).catch(function (err) {
    if (err === 'unwind' || (err && err.name === 'ExitStatus' && err.status === 0)) {
      overlay.classList.add('hidden');
      return;
    }
    fail('Failed to start.', String(err && err.message ? err.message : err));
    console.error(err);
  });
})();
