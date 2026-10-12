document.addEventListener('DOMContentLoaded', function () {
  var triggers = document.querySelectorAll('[data-figure]');
  if (!triggers.length || typeof HTMLDialogElement === 'undefined') return;

  var dialog = document.createElement('dialog');
  dialog.className = 'patent-lightbox';
  dialog.setAttribute('aria-labelledby', 'patent-lightbox-title');
  dialog.innerHTML = '<div class="patent-lightbox-head"><h2 id="patent-lightbox-title"></h2><button class="patent-lightbox-close" type="button">Close</button></div><figure><img alt="" /><figcaption></figcaption></figure>';
  document.body.appendChild(dialog);

  var title = dialog.querySelector('h2');
  var image = dialog.querySelector('img');
  var caption = dialog.querySelector('figcaption');
  var closeButton = dialog.querySelector('.patent-lightbox-close');
  var lastTrigger = null;

  function closeDialog() {
    if (dialog.open) dialog.close();
  }

  triggers.forEach(function (trigger) {
    trigger.addEventListener('click', function () {
      lastTrigger = trigger;
      title.textContent = trigger.getAttribute('data-title') || 'Patent figure';
      caption.textContent = trigger.getAttribute('data-caption') || '';
      image.src = trigger.getAttribute('data-figure');
      image.alt = trigger.querySelector('img') ? trigger.querySelector('img').alt : title.textContent;
      dialog.showModal();
      closeButton.focus();
    });
  });

  closeButton.addEventListener('click', closeDialog);
  dialog.addEventListener('click', function (event) {
    if (event.target === dialog) closeDialog();
  });
  dialog.addEventListener('close', function () {
    image.removeAttribute('src');
    if (lastTrigger) lastTrigger.focus();
  });
});
