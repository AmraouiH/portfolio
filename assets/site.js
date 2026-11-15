(function () {
    var root = document.documentElement;
    root.classList.add('js');

    // ---------- Theme toggle ----------
    var toggle = document.querySelector('.theme-toggle');
    if (toggle) {
        toggle.addEventListener('click', function () {
            var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
            root.setAttribute('data-theme', next);
            try { localStorage.setItem('theme', next); } catch (e) {}
        });
    }

    // ---------- Mobile menu ----------
    var navToggle = document.querySelector('.nav-toggle');
    var nav = document.querySelector('.site-header nav');
    if (navToggle && nav) {
        navToggle.addEventListener('click', function () {
            var open = nav.classList.toggle('open');
            navToggle.setAttribute('aria-expanded', open);
        });
        nav.querySelectorAll('a').forEach(function (a) {
            a.addEventListener('click', function () {
                nav.classList.remove('open');
                navToggle.setAttribute('aria-expanded', 'false');
            });
        });
    }

    // ---------- Header border on scroll ----------
    var header = document.querySelector('.site-header');
    var onScroll = function () {
        if (header) header.classList.toggle('scrolled', window.scrollY > 10);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // ---------- Active nav link ----------
    var links = Array.prototype.slice.call(document.querySelectorAll('.nav-menu a'));
    var sections = links
        .map(function (a) { var id = a.getAttribute('href').split('#')[1]; return id && document.getElementById(id); })
        .filter(Boolean);

    // ---------- Reveal on scroll ----------
    var reveals = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
        var revealObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12 });
        reveals.forEach(function (el) { revealObserver.observe(el); });

        var navObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                links.forEach(function (a) {
                    a.classList.toggle('active', a.getAttribute('href').split('#')[1] === entry.target.id);
                });
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        sections.forEach(function (s) { navObserver.observe(s); });
    } else {
        reveals.forEach(function (el) { el.classList.add('visible'); });
    }

    // ---------- Live download counters (NuGet search API and npm downloads API, both CORS enabled) ----------
    // Falls back silently to the static values rendered by Jekyll.
    var badges = document.querySelectorAll('[data-nuget], [data-npm]');
    var totalEl = document.querySelector('[data-total-downloads]');
    var format = function (n) { return n.toLocaleString('en-US'); };

    badges.forEach(function (b) {
        var n = parseInt(b.textContent, 10);
        if (!isNaN(n)) b.textContent = format(n);
    });

    if (!badges.length || !window.fetch) return;

    var nuget = function (id) {
        return fetch('https://azuresearch-usnc.nuget.org/query?q=packageid:' + encodeURIComponent(id) + '&prerelease=true')
            .then(function (r) { return r.json(); })
            .then(function (json) {
                var pkg = (json.data || []).find(function (d) { return d.id.toLowerCase() === id.toLowerCase(); });
                return pkg ? pkg.totalDownloads : 0;
            });
    };

    // The npm API serves at most 18 months per request: enough for packages published since 2025.
    var npm = function (id) {
        var day = function (d) { return d.toISOString().slice(0, 10); };
        var end = new Date(), start = new Date(end.getTime() - 540 * 86400000);
        return fetch('https://api.npmjs.org/downloads/point/' + day(start) + ':' + day(end) + '/' + encodeURIComponent(id))
            .then(function (r) { return r.json(); })
            .then(function (json) { return json.downloads || 0; });
    };

    var jobs = Array.prototype.map.call(badges, function (b) {
        var id = b.getAttribute('data-nuget') || b.getAttribute('data-npm');
        return { badge: b, load: b.hasAttribute('data-nuget') ? nuget(id) : npm(id) };
    });
    // EntityFieldsAnalyzer is an older package id of Entity Fields Analyser: counted in the total only.
    jobs.push({ badge: null, load: nuget('EntityFieldsAnalyzer') });

    Promise.all(jobs.map(function (job) {
        return job.load.catch(function () { return 0; }).then(function (n) {
            if (job.badge && n) job.badge.textContent = format(n);
            return n || parseInt((job.badge && job.badge.textContent || '').replace(/,/g, ''), 10) || 0;
        });
    })).then(function (counts) {
        var total = counts.reduce(function (a, n) { return a + n; }, 0);
        if (totalEl && total) totalEl.textContent = Math.floor(total / 1000) + 'k+';
    });
})();
