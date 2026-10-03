export type Language = 'pt' | 'es' | 'en';

export interface LanguageOption {
  code: Language;
  label: string;
  nativeName: string;
  flag: string;
}

export const AVAILABLE_LANGUAGES: LanguageOption[] = [
  { code: 'pt', label: 'Português', nativeName: 'Português (Brasil)', flag: '🇧🇷' },
  { code: 'es', label: 'Espanhol', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'Inglês', nativeName: 'English', flag: '🇺🇸' },
];

export interface Translations {
  common: {
    appName: string;
    tagline: string;
    loading: string;
    save: string;
    cancel: string;
    delete: string;
    confirm: string;
    back: string;
    next: string;
    search: string;
    filter: string;
    actions: string;
    status: string;
    success: string;
    error: string;
    all: string;
    none: string;
    close: string;
    exploreDemo: string;
    connectSpreadsheet: string;
    copy: string;
    copied: string;
    online: string;
    offline: string;
    sync: string;
    export: string;
    import: string;
    print: string;
    date: string;
    time: string;
    total: string;
  };
  auth: {
    welcome: string;
    welcomeSub: string;
    companySignUp: string;
    login: string;
    rosterLogin: string;
    forgotPassword: string;
    resetPassword: string;
    resetPasswordTitle: string;
    resetPasswordDesc: string;
    sendResetLink: string;
    resetSentSuccess: string;
    backToLogin: string;
    alreadyHaveAccount: string;
    dontHaveAccount: string;
    registerNewCompany: string;
    companyName: string;
    companyPlaceholder: string;
    managerName: string;
    managerPlaceholder: string;
    sector: string;
    sectorPlaceholder: string;
    email: string;
    emailPlaceholder: string;
    password: string;
    passwordPlaceholder: string;
    googleLogin: string;
    googleLoginDesc: string;
    orWithEmail: string;
    accessPlatform: string;
    createCompanyAndAccess: string;
    cloudSubtitle: string;
    featuresHighlight: string;
    freeSparkBadge: string;
    noCardRequired: string;
    multiDevice: string;
    selectCollaborator: string;
    enterPassword: string;
    searchCollaborator: string;
  };
  features: {
    dimensioningTitle: string;
    dimensioningDesc: string;
    radioTitle: string;
    radioDesc: string;
    breaksTitle: string;
    breaksDesc: string;
    portalTitle: string;
    portalDesc: string;
    cloudTitle: string;
    cloudDesc: string;
    reportsTitle: string;
    reportsDesc: string;
  };
  nav: {
    home: string;
    presence: string;
    assignment: string;
    breaks: string;
    team: string;
    calendar: string;
    briefing: string;
    reports: string;
    infoHub: string;
    radio: string;
    routines: string;
    requests: string;
    settings: string;
    operatorPortal: string;
    employeePanel: string;
    share: string;
    help: string;
  };
  status: {
    present: string;
    late: string;
    absent: string;
    dayOff: string;
    vacation: string;
    medicalLeave: string;
    license: string;
    training: string;
    hoursBank: string;
    unjustified: string;
  };
  header: {
    turnOf: string;
    shift: string;
    scale: string;
    userProfile: string;
    logout: string;
    notifications: string;
    theme: string;
    language: string;
    fullSector: string;
  };
  media: {
    mediaModeTitle: string;
    mediaModeDesc: string;
    mediaModeActive: string;
    mediaModeInactive: string;
    activateMediaMode: string;
    testAudio: string;
    testAudioSuccess: string;
    backgroundProtection: string;
    keepaliveDesc: string;
    audioUnlocked: string;
    notNow: string;
    recommended: string;
    honeywellAndroid: string;
  };
  portal: {
    title: string;
    myTasks: string;
    shiftInfo: string;
    todayAttendance: string;
    breakTimes: string;
    backgroundRadioHoneywell: string;
    backgroundRadioDesc: string;
    identifyOperator: string;
    operatorLabel: string;
    roleLabel: string;
    switchOperator: string;
  };
  settings: {
    title: string;
    subtitle: string;
    sectorsTab: string;
    integrationsTab: string;
    extensionTab: string;
    backupsTab: string;
    permissionsTab: string;
    portalTab: string;
    appearanceTab: string;
    auditTab: string;
    devTab: string;
  };
}
