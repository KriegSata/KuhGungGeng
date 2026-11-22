import '@testing-library/jest-dom/vitest';

// jsdom has no top-layer dialog implementation; mirror its open/close events.
HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new Event('close'));};
