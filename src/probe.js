import { mount } from 'svelte';
import DomProbe from './DomProbe.svelte';

mount(DomProbe, { target: document.getElementById('app') });
