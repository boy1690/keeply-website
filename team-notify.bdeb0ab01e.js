(function () {
  var form = document.getElementById('team-notify-form');
  var thanks = document.getElementById('team-notify-thanks');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var data = new FormData();
    data.append('entry.811615319', document.getElementById('tn-name').value);
    data.append('entry.1905692581', document.getElementById('tn-email').value);
    if (document.getElementById('tn-newsletter').checked) {
      data.append('entry.1908384673', 'yes');
    }
    fetch(
      'https://docs.google.com/forms/d/e/1FAIpQLSe8WpbHAy8wcAfZRdV1kiHOZa7riuxaOg7X_kgJadQX4GX0RA/formResponse',
      { method: 'POST', mode: 'no-cors', body: data }
    );
    form.style.display = 'none';
    if (thanks) thanks.style.display = 'block';
  });
})();
