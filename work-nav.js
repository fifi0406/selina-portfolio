(() => {
  const photographyLink = [...document.querySelectorAll('.nav a')].find((link) => {
    const url = new URL(link.href, location.href);
    return url.pathname.replace(/\/$/, '').endsWith('/photography.html');
  });
  if (photographyLink) photographyLink.remove();

  const workLink = [...document.querySelectorAll('.nav a')].find((link) => {
    const url = new URL(link.href, location.href);
    return url.pathname.replace(/\/$/, '').endsWith('/work.html');
  });
  if (workLink) {
    const wrapper = document.createElement('div');
    wrapper.className = 'nav-work-menu';
    const trigger = document.createElement('button');
    trigger.className = 'nav-work-toggle';
    trigger.type = 'button';
    trigger.textContent = 'Work';
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    const submenu = document.createElement('div');
    submenu.className = 'nav-work-submenu';
    submenu.id = 'workFormatMenu';
    const label = document.createElement('p');
    label.className = 'nav-work-submenu-label';
    label.textContent = 'Browse work by format';
    submenu.append(label);
    for (const [name, format] of [['Projects','project'],['Writing','writing'],['Audio','audio'],['Photography','photography'],['Video','video']]) {
      const item = document.createElement('a');
      item.href = `work.html?format=${format}#workFilters`;
      item.textContent = name;
      submenu.append(item);
    }
    trigger.setAttribute('aria-controls', submenu.id);
    wrapper.append(trigger, submenu);
    workLink.replaceWith(wrapper);
    const close = () => { submenu.classList.remove('open'); trigger.setAttribute('aria-expanded','false'); };
    const alignSubmenu = () => {
      const header = wrapper.closest('.topbar');
      if (header && window.matchMedia('(min-width: 761px)').matches) {
        submenu.style.left = `${trigger.getBoundingClientRect().left - header.getBoundingClientRect().left}px`;
      }
    };
    trigger.addEventListener('click', () => {
      alignSubmenu();
      const open = !submenu.classList.contains('open');
      submenu.classList.toggle('open', open);
      trigger.setAttribute('aria-expanded', String(open));
    });
    window.addEventListener('resize', alignSubmenu);
    document.addEventListener('click', (event) => { if (!wrapper.contains(event.target)) close(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { close(); trigger.focus(); } });
  }

  const tools = document.querySelector('.work-tools');
  if (tools) {
    tools.id = 'workFilters';
    const format = new URLSearchParams(location.search).get('format');
    if (format) {
      const filter = [...document.querySelectorAll('.filters [data-filter]')].find((button) => button.dataset.filter === format);
      if (filter) filter.click();
      if (location.hash === '#workFilters') requestAnimationFrame(() => tools.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }
})();
