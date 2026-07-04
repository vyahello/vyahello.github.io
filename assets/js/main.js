document.addEventListener('DOMContentLoaded', function () {
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Animated particle background — skipped for users who prefer reduced motion
    if (!reduceMotion && window.particlesJS) {
        particlesJS('particles-js', {
            particles: {
                number: { value: 30, density: { enable: true, value_area: 800 } },
                color: { value: '#00ff41' },
                shape: { type: 'polygon', stroke: { width: 0, color: '#000000' }, polygon: { nb_sides: 5 } },
                opacity: { value: 0.5, random: false },
                size: { value: 3, random: true },
                line_linked: { enable: true, distance: 150, color: '#00ff41', opacity: 0.4, width: 1 },
                move: { enable: true, speed: 4, direction: 'none', random: true, straight: false, out_mode: 'out', bounce: false }
            },
            interactivity: {
                detect_on: 'canvas',
                events: {
                    onhover: { enable: false, mode: 'grab' },
                    onclick: { enable: true, mode: 'push' },
                    resize: true
                },
                modes: { push: { particles_nb: 4 } }
            },
            retina_detect: true
        });
    }

    // Keep the footer year current
    var year = document.getElementById('footer-year');
    if (year) {
        year.textContent = new Date().getFullYear();
    }

    // Back-to-top button — appears after scrolling past the hero
    var toTop = document.getElementById('to-top');
    if (toTop) {
        var toggleToTop = function () {
            toTop.classList.toggle('is-visible', window.scrollY > window.innerHeight * 0.8);
        };
        window.addEventListener('scroll', toggleToTop, { passive: true });
        toggleToTop();
        toTop.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
        });
    }
});
