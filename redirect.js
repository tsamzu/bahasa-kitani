(() => {
  const target = new URL('./index.html', location.href), params = new URLSearchParams(location.search);
  if (!params.has('lang') && ['tutong', 'brunei', 'dusun', 'all'].includes(location.hash.slice(1))) params.set('lang', location.hash.slice(1));
  target.search = params.toString(); target.hash = '#dictionary'; location.replace(target.href);
})();
