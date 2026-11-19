(function () {
  try {
    var saved = localStorage.getItem('vectoria-theme');
    var valid = ['dark-purple', 'light-yellow', 'classic-mono', 'holographic', 'black-gold', 'neural-cyberpunk'];
    var theme = valid.indexOf(saved) !== -1 ? saved : 'dark-purple';
    var isDark =
      theme === 'dark-purple' ||
      theme === 'holographic' ||
      theme === 'black-gold' ||
      theme === 'neural-cyberpunk';
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark-purple');
    document.documentElement.style.colorScheme = 'dark';
    document.documentElement.classList.add('dark');
  }
})();
