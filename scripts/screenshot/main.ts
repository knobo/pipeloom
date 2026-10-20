// Runs the real UI in a plain browser with a recorded (anonymized) pw-dump instead of the Tauri backend.
import { mockIPC } from '@tauri-apps/api/mocks';
import { mount } from 'svelte';
import App from '../../src/App.svelte';
import '../../src/app.css';
import dump from './dump.json';

mockIPC((cmd) => (cmd === 'get_snapshot' ? dump : undefined), { shouldMockEvents: true });
mount(App, { target: document.getElementById('app')! });
