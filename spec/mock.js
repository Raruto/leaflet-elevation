import { JSDOM } from 'jsdom';

const { window } = new JSDOM('<main></main>');

global.window = window;
global.document = window.document;
global.navigator = window.navigator;
global.getComputedStyle = window.getComputedStyle;
global.requestAnimationFrame = null;

global.L = {
    DomEvent: {
        on: () => {},
        off: () => {}
    },
    Util: {
        throttle: () => {},
        wrapNum: () => {},
        formatNum: () => {}
    },
    DomUtil: {
        hasClass: () => {}
    }
};


