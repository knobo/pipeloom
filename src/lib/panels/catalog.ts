// Curated knowledge the dump doesn't carry: texts for WirePlumber settings, the PipeWire core
// `settings` metadata keys, config-file-only "hidden gems", symptoms, and one search index for all.
// Every user-visible text is `L` (Norwegian + English); the search indexes both languages.
// Verified against WirePlumber 0.5.13 / PipeWire 1.6.2 (/usr/share/{wireplumber,pipewire}, SPA plugin strings).
import type { Model } from '../model';
import { loc, tr, type L } from '../i18n.svelte';

const WP_DIR = '~/.config/wireplumber/wireplumber.conf.d';
const PW_DIR = '~/.config/pipewire';
const both = (x: L | undefined) => (x ? `${x.no} ${x.en}` : '');

/** Friendly section titles for WirePlumber setting prefixes. */
export const SECTION_TITLES: Record<string, L> = {
  bluetooth: { no: 'Bluetooth', en: 'Bluetooth' },
  device: { no: 'Enheter og lydkort', en: 'Devices and sound cards' },
  linking: { no: 'Kobling og ruting av strømmer', en: 'Stream linking and routing' },
  monitor: { no: 'Maskinvareoppdagelse', en: 'Hardware discovery' },
  node: { no: 'Noder, strømmer og volum', en: 'Nodes, streams and volume' },
};
export const sectionOf = (key: string) => key.split('.')[0];
export const sectionTitle = (prefix: string) => (SECTION_TITLES[prefix] ? loc(SECTION_TITLES[prefix]) : prefix);

/** Curated title/explanation for the WirePlumber settings schema. `tags` are search-only, both languages. */
export const WP_TEXT: Record<string, { title: L; text: L; tags?: string }> = {
  'bluetooth.use-persistent-storage': {
    title: { no: 'Husk Bluetooth-modus', en: 'Remember Bluetooth mode' },
    text: { no: 'Husker om headsettet sist var i hodesett-modus (med mikrofon) og gjenoppretter det.', en: 'Remembers whether the headset was last in headset mode (with microphone) and restores it.' },
  },
  'bluetooth.autoswitch-to-headset-profile': {
    title: { no: 'Bytt automatisk til hodesett-profil', en: 'Auto-switch to headset profile' },
    text: {
      no: 'Når en app tar opp lyd, bytter Bluetooth-hodetelefonene til hodesett-profil (HSP/HFP) så mikrofonen virker. Ulempen: lyden blir mono og telefonkvalitet. Slå av hvis musikken plutselig blir dårlig når du åpner Teams/Discord.',
      en: 'When an app records audio, Bluetooth headphones switch to the headset profile (HSP/HFP) so the microphone works. The downside: sound becomes mono, phone-call quality. Turn off if music suddenly sounds bad when you open Teams/Discord.',
    },
    tags: 'mikrofon headset hfp hsp a2dp telefonkvalitet dårlig lyd bytter profil mic microphone phone quality bad sound switches profile',
  },
  'device.restore-profile': {
    title: { no: 'Gjenopprett enhetsprofil', en: 'Restore device profile' },
    text: { no: 'Husker valgt profil (f.eks. analog stereo / HDMI) per lydkort.', en: 'Remembers the selected profile (e.g. analog stereo / HDMI) per sound card.' },
  },
  'device.restore-routes': {
    title: { no: 'Gjenopprett ruter', en: 'Restore routes' },
    text: { no: 'Husker valgt port (høyttaler/hodetelefon) og volumet på den.', en: 'Remembers the selected port (speakers/headphones) and its volume.' },
  },
  'device.routes.default-sink-volume': {
    title: { no: 'Standardvolum for utganger', en: 'Default output volume' },
    text: { no: 'Volumet en ny utgang får første gang den dukker opp (kubisk skala, 0.064 ≈ 40 %).', en: 'The volume a new output gets the first time it appears (cubic scale, 0.064 ≈ 40 %).' },
    tags: 'volum høyt lavt loud quiet',
  },
  'device.routes.default-source-volume': {
    title: { no: 'Standardvolum for innganger', en: 'Default input volume' },
    text: { no: 'Volumet en ny mikrofon/inngang får første gang den dukker opp.', en: 'The volume a new microphone/input gets the first time it appears.' },
    tags: 'volum mikrofon mic',
  },
  'device.routes.mute-on-alsa-playback-removed': {
    title: { no: 'Demp når kablede hodetelefoner trekkes ut', en: 'Mute when wired headphones are unplugged' },
    text: {
      no: 'Demper all lyd når aktive kablede hodetelefoner/høyttalere kobles fra, så lyden ikke plutselig kommer ut av høyttaleren.',
      en: 'Mutes all audio when active wired headphones/speakers are disconnected, so sound doesn’t suddenly blast from the speakers.',
    },
    tags: 'jack plugg ut demp mute unplug',
  },
  'device.routes.mute-on-bluetooth-playback-removed': {
    title: { no: 'Demp når Bluetooth-lyd kobles fra', en: 'Mute when Bluetooth audio disconnects' },
    text: { no: 'Demper all lyd når aktive Bluetooth-hodetelefoner kobles fra.', en: 'Mutes all audio when active Bluetooth headphones/speakers disconnect.' },
    tags: 'demp mute disconnect',
  },
  'linking.role-based.duck-level': {
    title: { no: 'Dempenivå («ducking»)', en: 'Ducking level' },
    text: { no: 'Hvor mye annen lyd senkes når en strøm med høyere prioritet (f.eks. navigasjon) spiller.', en: 'How much other audio is lowered while a higher-priority stream (e.g. navigation) plays.' },
    tags: 'duck demping volum',
  },
  'linking.allow-moving-streams': {
    title: { no: 'Tillat flytting av strømmer', en: 'Allow moving streams' },
    text: { no: 'Lar apper som pavucontrol flytte strømmer mellom enheter via metadata.', en: 'Lets apps like pavucontrol move streams between devices via metadata.' },
  },
  'linking.follow-default-target': {
    title: { no: 'Følg standardenheten', en: 'Follow the default device' },
    text: { no: 'Strømmer som spiller på standardenheten flytter med når du bytter standardenhet.', en: 'Streams playing on the default device move along when you change the default device.' },
    tags: 'bytte enhet standard switch',
  },
  'linking.pause-playback': {
    title: { no: 'Pause når utgangen forsvinner', en: 'Pause when the output disappears' },
    text: { no: 'Ber mediespillere pause når enheten de spiller på blir borte (f.eks. hodetelefoner trekkes ut).', en: 'Asks media players to pause when the device they play on goes away (e.g. headphones unplugged).' },
    tags: 'pause mpris',
  },
  'monitor.camera-discovery-timeout': {
    title: { no: 'Tidsavbrudd for kamerasøk', en: 'Camera discovery timeout' },
    text: { no: 'Hvor lenge (ms) det ventes på kameraoppdagelse ved oppstart.', en: 'How long (ms) to wait for camera discovery at startup.' },
    tags: 'kamera webkamera camera webcam',
  },
  'monitor.alsa.autodetect-hdmi-channels': {
    title: { no: 'Finn HDMI-kanaler automatisk (eksperimentelt)', en: 'Detect HDMI channels automatically (experimental)' },
    text: { no: 'Leser antall kanaler fra skjermen/forsterkeren via HDMI (ELD) i stedet for å anta stereo.', en: 'Reads the channel count from the display/receiver over HDMI (ELD) instead of assuming stereo.' },
    tags: 'hdmi surround 5.1 forsterker receiver amplifier',
  },
  'node.features.audio.no-dsp': {
    title: { no: 'Ingen DSP', en: 'No DSP' },
    text: { no: 'Ikke konverter lyd til 32-bit flyttall internt. Kun for spesielle behov.', en: 'Don’t convert audio to 32-bit float internally. Only for special needs.' },
  },
  'node.features.audio.monitor-ports': {
    title: { no: 'Monitor-porter', en: 'Monitor ports' },
    text: { no: 'Gir utganger «monitor»-porter så du kan ta opp det som spilles.', en: 'Gives outputs “monitor” ports so you can record what is playing.' },
    tags: 'opptak loopback record',
  },
  'node.features.audio.control-port': {
    title: { no: 'Kontrollporter', en: 'Control ports' },
    text: { no: 'Gir lydnoder kontrollporter (MIDI-lignende styring).', en: 'Gives audio nodes control ports (MIDI-like control).' },
  },
  'node.features.audio.mono': {
    title: { no: 'Mono på alle utganger', en: 'Mono on all outputs' },
    text: { no: 'Mikser alt til mono — nyttig med én høyttaler eller nedsatt hørsel på ett øre.', en: 'Mixes everything to mono — useful with a single speaker or hearing loss in one ear.' },
    tags: 'mono tilgjengelighet hørsel accessibility hearing',
  },
  'node.stream.restore-props': {
    title: { no: 'Husk volum per app', en: 'Remember volume per app' },
    text: { no: 'Husker volum/demping for hver app-strøm.', en: 'Remembers volume/mute for each app stream.' },
    tags: 'volum app',
  },
  'node.stream.restore-target': {
    title: { no: 'Husk enhet per app', en: 'Remember device per app' },
    text: { no: 'Husker hvilken enhet hver app sist spilte på.', en: 'Remembers which device each app last played on.' },
  },
  'node.stream.default-playback-volume': {
    title: { no: 'Startvolum for nye avspillings-strømmer', en: 'Initial volume for new playback streams' },
    text: { no: 'Volumet en app får første gang den spiller.', en: 'The volume an app gets the first time it plays.' },
    tags: 'volum',
  },
  'node.stream.default-capture-volume': {
    title: { no: 'Startvolum for nye opptaks-strømmer', en: 'Initial volume for new capture streams' },
    text: { no: 'Volumet en app får første gang den tar opp.', en: 'The volume an app gets the first time it records.' },
    tags: 'volum mikrofon mic',
  },
  'node.stream.default-media-role': {
    title: { no: 'Standard medierolle', en: 'Default media role' },
    text: { no: 'media.role som settes på strømmer som ikke oppgir en selv.', en: 'The media.role assigned to streams that don’t specify one.' },
  },
  'node.filter.forward-format': {
    title: { no: 'Videresend format på filtre', en: 'Forward format on filters' },
    text: { no: 'Filter-noder overtar formatet til enheten de er koblet til.', en: 'Filter nodes take on the format of the device they are linked to.' },
  },
  'node.restore-default-targets': {
    title: { no: 'Husk standardenheter', en: 'Remember default devices' },
    text: { no: 'Husker og gjenoppretter valgt standard inn- og utgang.', en: 'Remembers and restores the selected default input and output.' },
    tags: 'standard enhet bytter default device switches',
  },
};

/** PipeWire core runtime settings (metadata `settings`, subject 0). Not persisted: gone after restart. */
export interface CoreSetting {
  key: string; title: L; text: L; why: L;
  kind: 'int' | 'rates';
  min?: number; max?: number;
  options?: { value: number; label: L | string }[];
  /** PipeWire's stock default (pipewire.conf), for "changed" marking. */
  stock: number | number[];
  /** Value that means "use the configured default" (PipeWire treats 0 that way for clock.*). */
  reset?: string;
  tags?: string;
}
const QUANTA = [0, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192];
const quantumOpts = (zero: L) => QUANTA.map((v) => ({ value: v, label: v ? `${v} (${(v / 48).toFixed(1)} ms @48k)` : zero }));
const RATES = [44100, 48000, 88200, 96000, 176400, 192000];
const NO_FORCE: L = { no: '0 — ikke tving', en: '0 — don’t force' };
const CONF_DEFAULT: L = { no: '0 — konfigurert standard', en: '0 — configured default' };

export const CORE_SETTINGS: CoreSetting[] = [
  {
    key: 'clock.force-quantum', kind: 'int', min: 0, max: 8192, stock: 0, reset: '0',
    title: { no: 'Tving bufferstørrelse (quantum)', en: 'Force buffer size (quantum)' },
    options: quantumOpts(NO_FORCE),
    text: { no: 'Låser grafens quantum (antall samples per syklus) uansett hva appene ber om.', en: 'Locks the graph quantum (samples per cycle) regardless of what apps ask for.' },
    why: {
      no: 'Høyere verdi (1024–2048) fjerner ofte knitring/hakking når maskinen er travel; lavere (64–256) gir mindre forsinkelse for musikk/spill, men koster CPU og kan gi dropouts.',
      en: 'A higher value (1024–2048) often removes crackling/stuttering when the machine is busy; lower (64–256) gives less latency for music/games but costs CPU and can cause dropouts.',
    },
    tags: 'latency buffer knitring hakker forsinkelse xrun crackling stutter',
  },
  {
    key: 'clock.force-rate', kind: 'int', stock: 0, reset: '0',
    title: { no: 'Tving samplerate', en: 'Force sample rate' },
    options: [{ value: 0, label: NO_FORCE }, ...RATES.map((v) => ({ value: v, label: `${v} Hz` }))],
    text: { no: 'Låser grafens samplerate.', en: 'Locks the graph sample rate.' },
    why: {
      no: 'Nyttig for å teste bit-perfekt avspilling eller en enhet som bare tåler én rate. Raten må være støttet av maskinvaren.',
      en: 'Useful for testing bit-perfect playback or a device that only handles one rate. The rate must be supported by the hardware.',
    },
    tags: 'sample rate hz 44100 48000 bitperfect',
  },
  {
    key: 'clock.min-quantum', kind: 'int', min: 0, max: 8192, stock: 32, reset: '0',
    title: { no: 'Minste quantum', en: 'Minimum quantum' },
    options: quantumOpts(CONF_DEFAULT),
    text: { no: 'Den minste bufferen en app får lov å be om.', en: 'The smallest buffer an app is allowed to ask for.' },
    why: { no: 'Øk til 256–1024 hvis knitring kommer fra apper som ber om ekstremt lav latens.', en: 'Raise to 256–1024 if crackling comes from apps that ask for extremely low latency.' },
    tags: 'latency buffer knitring hakker crackling stutter',
  },
  {
    key: 'clock.max-quantum', kind: 'int', min: 0, max: 8192, stock: 2048, reset: '0',
    title: { no: 'Største quantum', en: 'Maximum quantum' },
    options: quantumOpts(CONF_DEFAULT),
    text: { no: 'Den største bufferen grafen kan bruke.', en: 'The largest buffer the graph may use.' },
    why: { no: 'Senk for å begrense forsinkelsen; øk for å spare strøm på bærbar ved ren avspilling.', en: 'Lower it to cap latency; raise it to save power on a laptop during plain playback.' },
    tags: 'latency buffer strøm batteri power battery',
  },
  {
    key: 'clock.quantum', kind: 'int', min: 0, max: 8192, stock: 1024, reset: '0',
    title: { no: 'Standard quantum', en: 'Default quantum' },
    options: quantumOpts(CONF_DEFAULT),
    text: { no: 'Bufferen som brukes når ingen app ber om noe spesielt.', en: 'The buffer used when no app asks for anything in particular.' },
    why: { no: 'Lavere gir mindre forsinkelse som standard; høyere er mer robust.', en: 'Lower gives less latency by default; higher is more robust.' },
    tags: 'latency buffer forsinkelse',
  },
  {
    key: 'clock.rate', kind: 'int', stock: 48000, reset: '0',
    title: { no: 'Standard samplerate', en: 'Default sample rate' },
    options: [{ value: 0, label: CONF_DEFAULT }, ...RATES.map((v) => ({ value: v, label: `${v} Hz` }))],
    text: { no: 'Raten grafen kjører på når ingen strøm krever noe annet.', en: 'The rate the graph runs at when no stream demands another.' },
    why: { no: 'Sjelden nødvendig — se også «Tillatte samplerater».', en: 'Rarely needed — see also “Allowed sample rates”.' },
    tags: 'sample rate hz',
  },
  {
    key: 'clock.allowed-rates', kind: 'rates', stock: [48000],
    title: { no: 'Tillatte samplerater', en: 'Allowed sample rates' },
    text: { no: 'Ratene grafen får bytte til når en strøm spiller med en annen rate.', en: 'The rates the graph may switch to when a stream plays at a different rate.' },
    why: {
      no: 'Legg til 44100 for å spille CD-/strømmemusikk uten resampling (bit-perfekt). Enheten må støtte ratene.',
      en: 'Add 44100 to play CD/streaming music without resampling (bit-perfect). The device must support the rates.',
    },
    tags: 'sample rate 44100 resampling bitperfect hifi',
  },
  {
    key: 'log.level', kind: 'int', min: 0, max: 5, stock: 2, reset: '2',
    title: { no: 'Loggnivå', en: 'Log level' },
    options: ([
      ['0 — ingen', '0 — none'], ['1 — feil', '1 — errors'], ['2 — advarsler', '2 — warnings'],
      ['3 — info', '3 — info'], ['4 — debug', '4 — debug'], ['5 — trace', '5 — trace'],
    ] as const).map(([no, en], value) => ({ value, label: { no, en } })),
    text: { no: 'Hvor mye PipeWire-daemonen logger (journalctl --user -u pipewire).', en: 'How much the PipeWire daemon logs (journalctl --user -u pipewire).' },
    why: { no: 'Skru opp midlertidig ved feilsøking; høye nivåer koster CPU og fyller journalen.', en: 'Turn up temporarily while troubleshooting; high levels cost CPU and fill the journal.' },
    tags: 'debug feilsøking journal log troubleshooting',
  },
];

/** Options that can't be changed at runtime, only via a config drop-in. */
export interface Gem {
  id: string; title: L; text: L;
  symptoms: L[];      // shown as chips, also searchable
  keys: string[];     // property names involved (searchable)
  file: string; snippet: string; // config code: same for both languages
  note?: L;
  restart: 'wireplumber' | 'pipewire' | 'pipewire-pulse';
  related?: string;   // focus id of a runtime setting with a similar effect
}

const alsaNodeRule = (props: string) => `monitor.alsa.rules = [
  {
    matches = [
      { node.name = "~alsa_output.*" }
    ]
    actions = {
      update-props = {
${props}
      }
    }
  }
]
`;

const PIPEWIRE_CLIENT_NOTE: L = {
  no: 'Legg samme fil i ~/.config/pipewire/client.conf.d/ for native PipeWire-apper.',
  en: 'Put the same file in ~/.config/pipewire/client.conf.d/ for native PipeWire apps.',
};

export const GEMS: Gem[] = [
  {
    id: 'suspend-timeout', keys: ['session.suspend-timeout-seconds'], restart: 'wireplumber',
    title: { no: 'Slå av dvale (suspend) på lydkort', en: 'Disable suspend on sound cards' },
    symptoms: [
      { no: 'pop eller klikk når lyden starter', en: 'pop or click when sound starts' },
      { no: 'begynnelsen av lyden kuttes', en: 'start of the sound is cut off' },
      { no: 'forsinkelse før lyden kommer', en: 'delay before sound plays' },
    ],
    text: {
      no: 'WirePlumber setter enheter i dvale etter 5 sekunder stillhet. Noen lydkort og Bluetooth-høyttalere smeller, klikker eller kutter første del av lyden når de våkner. 0 betyr «aldri dvale».',
      en: 'WirePlumber suspends devices after 5 seconds of silence. Some sound cards and Bluetooth speakers pop, click or cut off the first part of the sound when they wake up. 0 means “never suspend”.',
    },
    file: `${WP_DIR}/51-disable-suspension.conf`,
    snippet: `monitor.alsa.rules = [
  {
    matches = [
      { node.name = "~alsa_input.*" }
      { node.name = "~alsa_output.*" }
    ]
    actions = {
      update-props = {
        session.suspend-timeout-seconds = 0
      }
    }
  }
]
# Same for Bluetooth (remove if you don't need it)
monitor.bluez.rules = [
  {
    matches = [
      { node.name = "~bluez_input.*" }
      { node.name = "~bluez_output.*" }
    ]
    actions = {
      update-props = {
        session.suspend-timeout-seconds = 0
      }
    }
  }
]
`,
    note: {
      no: 'Litt høyere strømforbruk, og noen analoge utganger suser svakt når de alltid er på.',
      en: 'Slightly higher power use, and some analog outputs hiss faintly when always on.',
    },
  },
  {
    id: 'alsa-headroom', keys: ['api.alsa.headroom', 'api.alsa.period-size'], restart: 'wireplumber',
    title: { no: 'Ekstra buffer mot knitring på lydkortet', en: 'Extra sound card buffer against crackling' },
    symptoms: [
      { no: 'knitring', en: 'crackling' },
      { no: 'hakking', en: 'stuttering' },
      { no: 'lyd i virtuell maskin knitrer', en: 'audio crackles in a virtual machine' },
    ],
    text: {
      no: 'api.alsa.headroom gir ekstra samples i maskinvarebufferen; api.alsa.period-size endrer periodestørrelsen mot ALSA. Hjelper på lydkort/drivere med unøyaktig posisjonsrapportering.',
      en: 'api.alsa.headroom adds extra samples to the hardware buffer; api.alsa.period-size changes the ALSA period size. Helps sound cards/drivers with inaccurate position reporting.',
    },
    file: `${WP_DIR}/50-alsa-headroom.conf`,
    snippet: alsaNodeRule(`        api.alsa.headroom    = 1024
        api.alsa.period-size = 1024`),
    note: {
      no: 'Gir litt mer forsinkelse. Prøv headroom alene først; bytt matches til ditt eget node.name for å treffe bare ett kort.',
      en: 'Adds a little latency. Try headroom alone first; change matches to your own node.name to target just one card.',
    },
  },
  {
    id: 'clock-min-quantum', keys: ['default.clock.min-quantum', 'default.clock.quantum', 'default.clock.max-quantum'], restart: 'pipewire',
    title: { no: 'Permanent minste bufferstørrelse', en: 'Permanent minimum buffer size' },
    symptoms: [
      { no: 'knitring under belastning', en: 'crackling under load' },
      { no: 'hakking', en: 'stuttering' },
      { no: 'dropouts', en: 'dropouts' },
    ],
    text: {
      no: 'Samme som kjøretidsinnstillingen clock.min-quantum, men overlever omstart. PipeWire bruker selv 1024 som minimum i virtuelle maskiner.',
      en: 'Same as the runtime setting clock.min-quantum, but survives restarts. PipeWire itself uses 1024 as the minimum in virtual machines.',
    },
    file: `${PW_DIR}/pipewire.conf.d/10-quantum.conf`,
    snippet: `context.properties = {
    default.clock.min-quantum = 1024
}
`,
    related: 'settings:clock.min-quantum',
  },
  {
    id: 'low-latency', keys: ['default.clock.quantum', 'default.clock.min-quantum'], restart: 'pipewire',
    title: { no: 'Lav forsinkelse som standard', en: 'Low latency by default' },
    symptoms: [
      { no: 'lyd forsinket', en: 'audio delayed' },
      { no: 'forsinkelse', en: 'latency' },
      { no: 'latens i spill eller musikkprogram', en: 'latency in games or music software' },
    ],
    text: {
      no: 'Mindre standardbuffer gir lavere forsinkelse for alle apper som ikke ber om noe selv (256 samples ≈ 5,3 ms ved 48 kHz).',
      en: 'A smaller default buffer gives lower latency for all apps that don’t ask for one themselves (256 samples ≈ 5.3 ms at 48 kHz).',
    },
    file: `${PW_DIR}/pipewire.conf.d/10-low-latency.conf`,
    snippet: `context.properties = {
    default.clock.quantum     = 256
    default.clock.min-quantum = 64
}
`,
    note: { no: 'Mer CPU-bruk; gå tilbake opp hvis det begynner å knitre.', en: 'More CPU use; go back up if it starts crackling.' },
    related: 'settings:clock.quantum',
  },
  {
    id: 'allowed-rates', keys: ['default.clock.allowed-rates'], restart: 'pipewire',
    title: { no: 'Spill 44,1 kHz uten resampling', en: 'Play 44.1 kHz without resampling' },
    symptoms: [
      { no: 'dårlig lydkvalitet', en: 'poor sound quality' },
      { no: 'bit-perfekt', en: 'bit-perfect' },
      { no: 'resampling', en: 'resampling' },
    ],
    text: {
      no: 'Som standard kjører alt på 48 kHz og musikk i 44,1 kHz blir resamplet. Med flere tillatte rater bytter PipeWire rate når enheten er ledig. Fra PipeWires egen eksempelfil (client.conf.avail/10-rates.conf).',
      en: 'By default everything runs at 48 kHz and 44.1 kHz music gets resampled. With more allowed rates PipeWire switches rate when the device is idle. From PipeWire’s own example file (client.conf.avail/10-rates.conf).',
    },
    file: `${PW_DIR}/pipewire.conf.d/10-rates.conf`,
    snippet: `context.properties = {
    default.clock.allowed-rates = [ 44100 48000 88200 96000 ]
}
`,
    note: { no: 'Ta bare med rater lydkortet ditt støtter.', en: 'Only include rates your sound card supports.' },
    related: 'settings:clock.allowed-rates',
  },
  {
    id: 'pulse-min-quantum', keys: ['pulse.min.quantum', 'pulse.min.req'], restart: 'pipewire-pulse',
    title: { no: 'Minste buffer for PulseAudio-apper', en: 'Minimum buffer for PulseAudio apps' },
    symptoms: [
      { no: 'knitring i nettleser', en: 'crackling in the browser' },
      { no: 'knitring i Discord', en: 'crackling in Discord' },
      { no: 'hakking i Spotify', en: 'stuttering in Spotify' },
      { no: 'robotstemme', en: 'robotic voice' },
    ],
    text: {
      no: 'De fleste skrivebordsapper går via PulseAudio-laget. Et høyere minimum her fjerner knitring i bare disse appene uten å påvirke resten.',
      en: 'Most desktop apps go through the PulseAudio layer. A higher minimum here removes crackling in just those apps without affecting the rest.',
    },
    file: `${PW_DIR}/pipewire-pulse.conf.d/10-min-quantum.conf`,
    snippet: `pulse.properties = {
    pulse.min.quantum = 1024/48000   # 21 ms
}
`,
  },
  {
    id: 'resample-quality', keys: ['resample.quality'], restart: 'pipewire-pulse',
    title: { no: 'Bedre resampling-kvalitet', en: 'Better resampling quality' },
    symptoms: [
      { no: 'dårlig lydkvalitet', en: 'poor sound quality' },
      { no: 'metallisk lyd', en: 'metallic sound' },
    ],
    text: {
      no: 'Kvaliteten på sampleratekonvertering, 0–14 (standard 4). Høyere er bedre men bruker mer CPU. Gjelder strømmer som må resamples.',
      en: 'Sample-rate conversion quality, 0–14 (default 4). Higher is better but uses more CPU. Applies to streams that need resampling.',
    },
    file: `${PW_DIR}/pipewire-pulse.conf.d/20-resample.conf`,
    snippet: `stream.properties = {
    resample.quality = 10
}
`,
    note: PIPEWIRE_CLIENT_NOTE,
  },
  {
    id: 'upmix', keys: ['channelmix.upmix', 'channelmix.upmix-method', 'channelmix.lfe-cutoff'], restart: 'pipewire-pulse',
    title: { no: 'Stereo til surround (upmix)', en: 'Stereo to surround (upmix)' },
    symptoms: [
      { no: 'ingen lyd i bakhøyttalere', en: 'no sound from rear speakers' },
      { no: 'ingen lyd i subwoofer', en: 'no sound from subwoofer' },
      { no: 'surround 5.1', en: 'surround 5.1' },
    ],
    text: {
      no: 'Fordeler stereo til alle høyttalere på et surroundanlegg og sender bass til subwooferen. Av som standard. Fra PipeWires egen eksempelfil (20-upmix.conf).',
      en: 'Spreads stereo across all speakers of a surround system and sends bass to the subwoofer. Off by default. From PipeWire’s own example file (20-upmix.conf).',
    },
    file: `${PW_DIR}/pipewire-pulse.conf.d/20-upmix.conf`,
    snippet: `stream.properties = {
    channelmix.upmix        = true
    channelmix.upmix-method = psd    # none, simple, psd
    channelmix.lfe-cutoff   = 150    # Hz to the subwoofer
    channelmix.fc-cutoff    = 12000
    channelmix.rear-delay   = 12.0
}
`,
    note: PIPEWIRE_CLIENT_NOTE,
  },
  {
    id: 'bt-hw-volume', keys: ['bluez5.enable-hw-volume'], restart: 'wireplumber',
    title: { no: 'Slå av Bluetooth maskinvarevolum', en: 'Disable Bluetooth hardware volume' },
    symptoms: [
      { no: 'bluetooth volum hopper', en: 'bluetooth volume jumps' },
      { no: 'bluetooth for høyt', en: 'bluetooth too loud' },
      { no: 'bluetooth volum synkes ikke', en: 'bluetooth volume out of sync' },
    ],
    text: {
      no: 'Som standard styres volumet i selve hodetelefonene (AVRCP). Noen enheter takler dette dårlig: volumet hopper, blir alt for høyt eller kjemper mot PC-en. Av = PC-en skalerer lyden selv.',
      en: 'By default volume is controlled in the headphones themselves (AVRCP). Some devices handle this badly: volume jumps, gets far too loud or fights the computer. Off = the computer scales the audio itself.',
    },
    file: `${WP_DIR}/80-bluez.conf`,
    snippet: `monitor.bluez.properties = {
    bluez5.enable-hw-volume = false
}
`,
  },
  {
    id: 'bt-codecs', keys: ['bluez5.codecs', 'bluez5.enable-sbc-xq'], restart: 'wireplumber',
    title: { no: 'Velg hvilke Bluetooth-kodeker som tilbys', en: 'Choose which Bluetooth codecs are offered' },
    symptoms: [
      { no: 'bluetooth dårlig lydkvalitet', en: 'bluetooth poor sound quality' },
      { no: 'bluetooth hakker', en: 'bluetooth stutters' },
      { no: 'bluetooth kodek', en: 'bluetooth codec' },
      { no: 'aptx ldac aac', en: 'aptx ldac aac' },
    ],
    text: {
      no: 'Begrens eller tillat kodeker. Fjern en kodek som hakker med akkurat dine hodetelefoner, eller sørg for at SBC-XQ er med for bedre kvalitet på enheter uten AAC/aptX/LDAC.',
      en: 'Restrict or allow codecs. Remove a codec that stutters with your particular headphones, or make sure SBC-XQ is included for better quality on devices without AAC/aptX/LDAC.',
    },
    file: `${WP_DIR}/80-bluez.conf`,
    snippet: `monitor.bluez.properties = {
    bluez5.enable-sbc-xq = true
    bluez5.codecs = [ sbc sbc_xq aac ldac aptx aptx_hd ]
}
`,
    note: { no: 'Kodek velges når enheten kobler til; koble fra og til etter endring.', en: 'The codec is chosen when the device connects; disconnect and reconnect after a change.' },
  },
  {
    id: 'bt-ldac-quality', keys: ['bluez5.a2dp.ldac.quality'], restart: 'wireplumber',
    title: { no: 'LDAC-kvalitet (bitrate)', en: 'LDAC quality (bitrate)' },
    symptoms: [
      { no: 'LDAC hakker', en: 'LDAC stutters' },
      { no: 'bluetooth faller ut', en: 'bluetooth drops out' },
      { no: 'bluetooth hakker på avstand', en: 'bluetooth stutters at a distance' },
    ],
    text: {
      no: '«hq» (990 kbps) hakker lett med støy i 2,4 GHz-båndet. «sq» (660) og «mq» (330) er mer robuste; «auto» (standard) justerer etter forbindelsen.',
      en: '“hq” (990 kbps) easily stutters with noise in the 2.4 GHz band. “sq” (660) and “mq” (330) are more robust; “auto” (default) adapts to the connection.',
    },
    file: `${WP_DIR}/80-bluez-ldac.conf`,
    snippet: `monitor.bluez.rules = [
  {
    matches = [
      { device.name = "~bluez_card.*" }
    ]
    actions = {
      update-props = {
        bluez5.a2dp.ldac.quality = "sq"   # auto, hq, sq, mq
      }
    }
  }
]
`,
  },
  {
    id: 'bt-roles-a2dp-only', keys: ['bluez5.roles'], restart: 'wireplumber',
    title: { no: 'Aldri hodesett-modus på Bluetooth', en: 'Never use headset mode on Bluetooth' },
    symptoms: [
      { no: 'bluetooth lyd blir dårlig plutselig', en: 'bluetooth sound suddenly gets bad' },
      { no: 'bluetooth blir mono', en: 'bluetooth turns mono' },
      { no: 'telefonkvalitet', en: 'phone-call quality' },
    ],
    text: {
      no: 'Fjerner HFP/HSP-rollene helt, så hodetelefonene aldri bytter til telefonkvalitet. Mikrofonen i headsettet blir da utilgjengelig — bruk PC-ens mikrofon.',
      en: 'Removes the HFP/HSP roles entirely, so the headphones never switch to phone-call quality. The headset microphone then becomes unavailable — use the computer’s microphone.',
    },
    file: `${WP_DIR}/80-bluez.conf`,
    snippet: `monitor.bluez.properties = {
    bluez5.roles = [ a2dp_sink a2dp_source bap_sink bap_source ]
}
`,
    note: {
      no: 'Mildere variant uten konfigfil: slå av «Bytt automatisk til hodesett-profil».',
      en: 'Milder option without a config file: turn off “Auto-switch to headset profile”.',
    },
    related: 'bluetooth.autoswitch-to-headset-profile',
  },
  {
    id: 'bt-msbc', keys: ['bluez5.enable-msbc', 'bluez5.hfphsp-backend'], restart: 'wireplumber',
    title: { no: 'Bedre mikrofon på Bluetooth-headset (mSBC)', en: 'Better microphone on Bluetooth headsets (mSBC)' },
    symptoms: [
      { no: 'dårlig mikrofon på bluetooth-headset', en: 'poor mic quality on bluetooth headset' },
      { no: 'mikrofon dårlig', en: 'bad microphone' },
      { no: 'mikrofon høres ut som telefon', en: 'microphone sounds like a phone' },
    ],
    text: {
      no: 'HFP-mikrofon er alltid begrenset, men mSBC (bredbånd, 16 kHz) er mye bedre enn CVSD (8 kHz). Det er på som standard — sjekk at ingen konfig har slått det av, og at den innebygde («native») HFP-backenden brukes.',
      en: 'HFP microphone quality is always limited, but mSBC (wideband, 16 kHz) is much better than CVSD (8 kHz). It is on by default — check that no config has turned it off and that the built-in (“native”) HFP backend is used.',
    },
    file: `${WP_DIR}/80-bluez.conf`,
    snippet: `monitor.bluez.properties = {
    bluez5.enable-msbc    = true
    bluez5.hfphsp-backend = "native"   # native, ofono, none
}
`,
    note: {
      no: 'Beste løsning er ofte å bruke PC-ens mikrofon og la hodetelefonene stå i A2DP (høy kvalitet).',
      en: 'The best fix is often to use the computer’s microphone and keep the headphones in A2DP (high quality).',
    },
    related: 'bluetooth.autoswitch-to-headset-profile',
  },
  {
    id: 'device-disabled', keys: ['device.disabled', 'node.disabled'], restart: 'wireplumber',
    title: { no: 'Skjul en enhet du aldri bruker', en: 'Hide a device you never use' },
    symptoms: [
      { no: 'for mange enheter', en: 'too many devices' },
      { no: 'hdmi-utganger i lista', en: 'hdmi outputs in the list' },
      { no: 'feil enhet velges', en: 'wrong device gets picked' },
    ],
    text: {
      no: 'device.disabled skjuler et helt lydkort; node.disabled bare én inn-/utgang. Finn navnet i Enheter-fanen (device.name / node.name).',
      en: 'device.disabled hides a whole sound card; node.disabled just one input/output. Find the name in the Devices tab (device.name / node.name).',
    },
    file: `${WP_DIR}/51-disable-device.conf`,
    snippet: `monitor.alsa.rules = [
  {
    matches = [
      { device.name = "alsa_card.pci-0000_01_00.1" }   # change to your card
    ]
    actions = {
      update-props = {
        device.disabled = true
      }
    }
  }
]
`,
  },
  {
    id: 'priority-session', keys: ['priority.session', 'priority.driver'], restart: 'wireplumber',
    title: { no: 'Bestem hvilken enhet som blir standard', en: 'Choose which device becomes the default' },
    symptoms: [
      { no: 'feil enhet blir standard', en: 'wrong device becomes default' },
      { no: 'standardenhet bytter av seg selv etter omstart', en: 'default device changes by itself after restart' },
    ],
    text: {
      no: 'Når ingen standard er valgt (eller valgt enhet mangler), vinner noden med høyest priority.session. Gi favoritten en høy verdi.',
      en: 'When no default is chosen (or the chosen device is missing), the node with the highest priority.session wins. Give your favourite a high value.',
    },
    file: `${WP_DIR}/51-priority.conf`,
    snippet: `monitor.alsa.rules = [
  {
    matches = [
      { node.name = "alsa_output.usb-MyDAC-00.analog-stereo" }   # change to your node
    ]
    actions = {
      update-props = {
        priority.session = 2000
        priority.driver  = 2000
      }
    }
  }
]
`,
    related: 'node.restore-default-targets',
  },
  {
    id: 'rename-node', keys: ['node.description', 'node.nick'], restart: 'wireplumber',
    title: { no: 'Gi en enhet et eget navn', en: 'Give a device your own name' },
    symptoms: [
      { no: 'kryptiske navn', en: 'cryptic names' },
      { no: 'to like enheter', en: 'two identical devices' },
      { no: 'gi nytt navn', en: 'rename' },
    ],
    text: { no: 'Overstyr navnet som vises i alle lydprogrammer.', en: 'Override the name shown in all audio programs.' },
    file: `${WP_DIR}/51-rename.conf`,
    snippet: `monitor.alsa.rules = [
  {
    matches = [
      { node.name = "alsa_output.pci-0000_00_1f.3.analog-stereo" }   # change to your node
    ]
    actions = {
      update-props = {
        node.description = "Living room speakers"
        node.nick        = "Living room"
      }
    }
  }
]
`,
  },
  {
    id: 'soft-mixer', keys: ['api.alsa.soft-mixer'], restart: 'wireplumber',
    title: { no: 'Bruk programvarevolum i stedet for lydkortets mikser', en: 'Use software volume instead of the sound card mixer' },
    symptoms: [
      { no: 'volumkontroll virker rart', en: 'volume control behaves oddly' },
      { no: 'volum hopper', en: 'volume jumps' },
      { no: 'for lav lyd selv på 100 %', en: 'too quiet even at 100 %' },
      { no: 'volum gjør ingenting', en: 'volume does nothing' },
    ],
    text: {
      no: 'Noen lydkort har feil eller rare hardware-miksere. Med soft-mixer settes maskinvaren til fast nivå og PipeWire skalerer volumet selv.',
      en: 'Some sound cards have broken or odd hardware mixers. With soft-mixer the hardware is set to a fixed level and PipeWire scales the volume itself.',
    },
    file: `${WP_DIR}/51-soft-mixer.conf`,
    snippet: `monitor.alsa.rules = [
  {
    matches = [
      { device.name = "~alsa_card.*" }
    ]
    actions = {
      update-props = {
        api.alsa.soft-mixer = true
      }
    }
  }
]
`,
  },
];

export const RESTART_CMD: Record<Gem['restart'], string> = {
  wireplumber: 'systemctl --user restart wireplumber',
  pipewire: 'systemctl --user restart pipewire pipewire-pulse wireplumber',
  'pipewire-pulse': 'systemctl --user restart pipewire-pulse',
};

/** Symptom → what to look at. `words` (both languages) are matched by the search, targets are focus ids. */
export interface Symptom { label: L; words: string; targets: string[] }
export const SYMPTOMS: Symptom[] = [
  {
    label: { no: 'Knitring / hakking', en: 'Crackling / stuttering' },
    words: 'knitring knitrer knitre hakker hakking hakkete crackling crackle crackles stutter stuttering choppy skipping xrun underrun dropout glitch skurring distortion',
    targets: ['settings:clock.force-quantum', 'settings:clock.min-quantum', 'gem:clock-min-quantum', 'gem:pulse-min-quantum', 'gem:alsa-headroom', 'gem:suspend-timeout'],
  },
  {
    label: { no: 'Lyden kuttes i starten / pops', en: 'Sound cut off at start / pops' },
    words: 'pop pops popper popping klikk klikker smell kuttes starten begynnelsen click clicking cut off',
    targets: ['gem:suspend-timeout'],
  },
  {
    label: { no: 'Lyd forsinket', en: 'Audio delayed' },
    words: 'forsinket forsinkelse latens latency delay delayed lag etterslep',
    targets: ['settings:clock.force-quantum', 'settings:clock.quantum', 'gem:low-latency', 'gem:suspend-timeout'],
  },
  {
    label: { no: 'Dårlig BT-mikrofon', en: 'Poor BT microphone' },
    words: 'mikrofon mic microphone headset hodesett hfp hsp msbc',
    targets: ['bluetooth.autoswitch-to-headset-profile', 'gem:bt-msbc', 'gem:bt-roles-a2dp-only'],
  },
  {
    label: { no: 'Bluetooth', en: 'Bluetooth' }, words: 'bluetooth bt bluez trådløs wireless a2dp',
    targets: ['bluetooth.autoswitch-to-headset-profile', 'bluetooth.use-persistent-storage', 'gem:bt-hw-volume', 'gem:bt-codecs', 'gem:bt-ldac-quality', 'gem:bt-roles-a2dp-only', 'gem:bt-msbc'],
  },
  {
    label: { no: 'Volum oppfører seg rart', en: 'Volume behaves oddly' }, words: 'volum volume høyt lavt loud quiet',
    targets: ['gem:soft-mixer', 'gem:bt-hw-volume', 'device.routes.default-sink-volume', 'node.stream.restore-props'],
  },
  {
    label: { no: 'Feil standardenhet', en: 'Wrong default device' }, words: 'standard default enhet device feil wrong bytter switches',
    targets: ['node.restore-default-targets', 'linking.follow-default-target', 'gem:priority-session', 'gem:device-disabled'],
  },
  {
    label: { no: 'Lydkvalitet', en: 'Sound quality' }, words: 'kvalitet quality dårlig poor bad lydkvalitet hifi bitperfekt bitperfect resampling',
    targets: ['gem:allowed-rates', 'gem:resample-quality', 'gem:bt-codecs', 'settings:clock.allowed-rates'],
  },
];

/** Generic English ↔ Norwegian synonyms applied to query tokens. */
const SYNONYMS: string[][] = [
  ['lagre', 'save', 'persist'], ['volum', 'volume'], ['mikrofon', 'mic', 'microphone', 'capture', 'opptak'],
  ['utgang', 'output', 'sink', 'høyttaler', 'speaker'], ['inngang', 'input', 'source'],
  ['enhet', 'device', 'card', 'lydkort'], ['standard', 'default'], ['demp', 'mute'],
  ['bytt', 'switch', 'autoswitch'], ['husk', 'restore', 'remember', 'gjenopprett'],
  ['forsinkelse', 'latency', 'quantum', 'buffer'], ['samplerate', 'rate', 'hz'],
];

// ---------------------------------------------------------------------------------------------
// Search index shared by SettingsPanel and CommandPalette.

export type DocKind = 'wp' | 'core' | 'gem' | 'meta' | 'node' | 'device';
export interface Doc {
  id: string;     // focus id: WP key, "<metadata>:<key>", "gem:<id>", "node:<id>", "device:<id>"
  kind: DocKind; group: string;
  key: string; title: string; detail: string;
  type?: string; value?: unknown; changed?: boolean;
  hay: { key: string; title: string; text: string };
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const show = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));
export const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Parse a `settings` metadata value (number or "[ 44100 48000 ]") into something comparable. */
export function parseCore(v: unknown): number | number[] | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (s.startsWith('[')) return s.slice(1, -1).split(/[\s,]+/).filter(Boolean).map(Number);
  const n = Number(s);
  return Number.isNaN(n) ? undefined : n;
}

/** Symptom words that point at a focus id, appended to its haystack. */
function symptomWords(id: string) {
  return SYMPTOMS.filter((s) => s.targets.includes(id)).map((s) => `${both(s.label)} ${s.words}`).join(' ');
}

// Already shown elsewhere in the settings page, or internal.
export const HIDDEN_META = new Set(['settings', 'schema-sm-settings', 'sm-settings', 'persistent-sm-settings']);

export function buildIndex(model: Model, opts: { objects?: boolean } = {}): Doc[] {
  const docs: Doc[] = [];
  // Shown texts follow the UI language; the haystack holds both languages so search works in either.
  const add = (d: Omit<Doc, 'hay'>, extra = '', titles = d.title, details = d.detail) =>
    docs.push({ ...d, hay: { key: norm(d.key), title: norm(titles), text: norm(`${details} ${extra} ${symptomWords(d.id)}`) } });

  for (const s of model.settings) {
    const t = WP_TEXT[s.key];
    add({
      id: s.key, kind: 'wp', group: 'WirePlumber', key: s.key, title: t ? loc(t.title) : s.name,
      detail: t ? loc(t.text) : s.description, type: s.type, value: s.value, changed: !same(s.value, s.default),
    }, `${s.name} ${s.description} ${t?.tags ?? ''} ${both(SECTION_TITLES[sectionOf(s.key)])}`, t ? both(t.title) : s.name, t ? both(t.text) : s.description);
  }
  const core = new Map((model.metadata.get('settings')?.entries ?? []).filter((e) => e.subject === 0).map((e) => [e.key, e.value]));
  for (const c of CORE_SETTINGS) {
    const v = core.get(c.key);
    add({
      id: `settings:${c.key}`, kind: 'core', group: tr('PipeWire-kjerne', 'PipeWire core'), key: c.key, title: loc(c.title),
      detail: loc(c.text), type: c.kind, value: v, changed: v !== undefined && !same(parseCore(v), c.stock),
    }, `${both(c.why)} ${c.tags ?? ''}`, both(c.title), both(c.text));
  }
  for (const g of GEMS) {
    add({ id: `gem:${g.id}`, kind: 'gem', group: tr('Skjulte perler', 'Hidden gems'), key: g.keys.join(' '), title: loc(g.title), detail: loc(g.text), type: tr('konfig', 'config') },
      `${g.symptoms.map(both).join(' ')} ${g.file} ${both(g.note)}`, both(g.title), both(g.text));
  }
  for (const m of model.metadata.values()) {
    if (HIDDEN_META.has(m.name)) continue;
    for (const e of m.entries) {
      add({ id: `${m.name}:${e.key}`, kind: 'meta', group: `Metadata · ${m.name}`, key: e.key, title: e.key, detail: show(e.value), value: e.value, type: m.name });
    }
  }
  if (opts.objects) {
    for (const n of model.nodes.values()) {
      add({ id: `node:${n.id}`, kind: 'node', group: tr('Noder', 'Nodes'), key: n.name, title: n.label, detail: [n.app, n.mediaClass].filter(Boolean).join(' · '), type: n.mediaClass },
        `${n.props['node.nick'] ?? ''} ${n.props['application.process.binary'] ?? ''}`);
    }
    for (const d of model.devices.values()) {
      add({ id: `device:${d.id}`, kind: 'device', group: tr('Enheter', 'Devices'), key: d.name, title: d.description, detail: [d.api, d.bus].filter(Boolean).join(' · '), type: d.api });
    }
  }
  return docs;
}

const SYN = SYNONYMS.map((g) => g.map(norm)); // query tokens are normalized (å → a), so must the synonyms be
function variants(tok: string): string[] {
  const out = new Set([tok]);
  for (const g of SYN) if (g.some((w) => w === tok || (tok.length >= 4 && w.startsWith(tok)))) g.forEach((w) => out.add(w));
  return [...out];
}

function isSubsequence(needle: string, hay: string) {
  let i = 0;
  for (const ch of hay) if (ch === needle[i] && ++i === needle.length) return true;
  return false;
}

/** Score one token against a doc; 0 = no match. */
function tokenScore(tok: string, h: Doc['hay']): number {
  let best = 0;
  for (const v of variants(tok)) {
    const syn = v === tok ? 1 : 0.6;
    const wordStart = (s: string) => new RegExp(`(^|[^a-z0-9])${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(s);
    let s = 0;
    if (h.key === v) s = 100;
    else if (h.key.includes(v)) s = wordStart(h.key) ? 60 : 45;
    else if (h.title.includes(v)) s = wordStart(h.title) ? 40 : 30;
    else if (h.text.includes(v)) s = wordStart(h.text) ? 20 : 12;
    // crude stemming: "knitrer" → "knitr" also hits "knitring"
    else if (v.length >= 6 && (h.title + ' ' + h.text).includes(v.slice(0, v.length - 2))) s = 8;
    else if (v.length >= 3 && isSubsequence(v, h.key)) s = 4;
    best = Math.max(best, s * syn);
  }
  return best;
}

/** All tokens must match somewhere. Returns docs sorted by score (desc). Empty query → all, in order. */
export function search(docs: Doc[], query: string): Doc[] {
  const toks = norm(query).split(/\s+/).filter(Boolean);
  if (!toks.length) return docs;
  const scored: [Doc, number][] = [];
  for (const d of docs) {
    let total = 0;
    for (const t of toks) {
      const s = tokenScore(t, d.hay);
      if (!s) { total = 0; break; }
      total += s;
    }
    if (total) scored.push([d, total]);
  }
  return scored.sort((a, b) => b[1] - a[1]).map(([d]) => d);
}
