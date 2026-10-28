(() => { const target = new URL('./index.html', location.href); target.search = location.search; target.hash = '#dictionary'; location.replace(target.href); })();
