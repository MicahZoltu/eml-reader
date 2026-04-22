(function () {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };

  function renderAddresses(addrs) {
    if (!addrs || addrs.length === 0) return '';
    return addrs.join(', ');
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function blobUrlForPart(part) {
    var mime = part.contentType.type || 'application/octet-stream';
    var bytes;
    if (typeof atob !== 'undefined') {
      var b = atob(part.rawBody.replace(/\s+/g, ''));
      bytes = new Uint8Array(b.length);
      for (var i = 0; i < b.length; i++) bytes[i] = b.charCodeAt(i);
    } else {
      bytes = new Uint8Array(part.rawBody.length);
      for (var i = 0; i < part.rawBody.length; i++) bytes[i] = part.rawBody.charCodeAt(i) & 0xFF;
    }
    var blob = new Blob([bytes], { type: mime });
    return URL.createObjectURL(blob);
  }

  function showResult(parsed) {
    $('#envelope').classList.remove('hidden');
    $('#body-section').classList.remove('hidden');
    $('#attachments-section').classList.add('hidden');
    $('#raw-headers-section').classList.add('hidden');

    $('#env-from').textContent = parsed.from || '(no from)';
    $('#env-to').textContent = renderAddresses(parsed.to) || '(no to)';
    $('#env-cc').textContent = renderAddresses(parsed.cc) || '(no cc)';
    $('#env-bcc').textContent = renderAddresses(parsed.bcc) || '(no bcc)';
    $('#env-subject').textContent = parsed.subject || '(no subject)';
    $('#env-date').textContent = parsed.date || '(no date)';

    var bodySection = $('#body-content');
    bodySection.innerHTML = '';

    if (parsed.htmlBody) {
      var tabs = document.createElement('div');
      tabs.className = 'tabs';
      var btnHtml = document.createElement('button');
      btnHtml.className = 'tab active';
      btnHtml.textContent = 'HTML';
      var btnText = document.createElement('button');
      btnText.className = 'tab';
      btnText.textContent = 'Plain text';
      tabs.appendChild(btnHtml);
      tabs.appendChild(btnText);
      bodySection.appendChild(tabs);

      var iframe = document.createElement('iframe');
      iframe.sandbox = 'allow-same-origin';
      iframe.srcdoc = parsed.htmlBody;
      bodySection.appendChild(iframe);

      var pre = document.createElement('pre');
      pre.className = 'pre-wrap hidden';
      pre.textContent = parsed.textBody || '(no plain text)';
      bodySection.appendChild(pre);

      btnHtml.addEventListener('click', function () {
        btnHtml.classList.add('active');
        btnText.classList.remove('active');
        iframe.classList.remove('hidden');
        pre.classList.add('hidden');
      });
      btnText.addEventListener('click', function () {
        btnText.classList.add('active');
        btnHtml.classList.remove('active');
        iframe.classList.add('hidden');
        pre.classList.remove('hidden');
      });
    } else if (parsed.textBody) {
      var pre = document.createElement('pre');
      pre.className = 'pre-wrap';
      pre.textContent = parsed.textBody;
      bodySection.appendChild(pre);
    } else {
      bodySection.innerHTML = '<p class="value">(no body)</p>';
    }

    var attList = $('#attachments-list');
    attList.innerHTML = '';
    if (parsed.attachments && parsed.attachments.length > 0) {
      $('#attachments-section').classList.remove('hidden');
      parsed.attachments.forEach(function (att, idx) {
        var li = document.createElement('li');
        var info = document.createElement('div');
        info.className = 'attachment-info';
        info.textContent = att.filename || ('attachment-' + (idx + 1));
        var meta = document.createElement('div');
        meta.className = 'attachment-meta';
        meta.textContent = (att.contentType.type || 'application/octet-stream');
        info.appendChild(meta);

        var actions = document.createElement('div');
        var a = document.createElement('a');
        a.className = 'btn';
        a.textContent = 'Download';
        a.href = blobUrlForPart(att);
        a.download = att.filename || 'attachment';
        actions.appendChild(a);

        li.appendChild(info);
        li.appendChild(actions);
        attList.appendChild(li);
      });
    }

    $('#raw-headers-content').textContent = parsed.rawHeaders || '';
  }

  function handleFile(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var data = e.target.result;
        var parsed = EmlParser.parseEml(data);
        showResult(parsed);
      } catch (err) {
        alert('Failed to parse EML: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  $('#upload').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (file) handleFile(file);
  });

  $('#toggle-headers').addEventListener('click', function () {
    var el = $('#raw-headers-section');
    el.classList.toggle('hidden');
    this.textContent = el.classList.contains('hidden') ? 'Show raw headers' : 'Hide raw headers';
  });

})();
