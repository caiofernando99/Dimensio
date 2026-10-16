with open('src/context/CommunicationContext.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add Task import
text = text.replace(
    "import type { CommChannel, CommPeerInfo, RemotePeerState, SignalMessage, AudioMode } from '../communication/types';",
    "import type { CommChannel, CommPeerInfo, RemotePeerState, SignalMessage, AudioMode } from '../communication/types';\nimport type { Task } from '../types';"
)

# 2. Add myAssignedTasks & myCurrentTask to CommContextType
old_type = """  refreshAudioOutputDevices: () => Promise<void>;
}"""
new_type = """  refreshAudioOutputDevices: () => Promise<void>;
  myAssignedTasks: Task[];
  myCurrentTask: Task | null;
}"""
assert old_type in text, "old_type not found"
text = text.replace(old_type, new_type, 1)

# 3. Update task auto-assignment logic
# Let's find the exact text in CommunicationContext.tsx around useEffect [identifiedUser, state.tasks, activeChannel]
idx_task = text.find("const collabId = identifiedUser")
assert idx_task != -1, "collabId not found"
idx_start = text.rfind("useEffect(() => {", 0, idx_task)
idx_end = text.find("}, [identifiedUser, state.tasks, activeChannel]);", idx_task) + len("}, [identifiedUser, state.tasks, activeChannel]);")

old_task_block = text[idx_start:idx_end]

new_task_block = """// Auto-atribuição dinâmica ao canal da(s) tarefa(s) atribuída(s)
  const myAssignedTasks = useMemo(() => {
    const identity = resolveCurrentIdentity();
    const collabId = identity.id && !identity.id.startsWith('anon_') ? identity.id : '';
    if (!collabId) return [];
    return state.tasks.filter((t) => t.active !== false && t.members.includes(collabId));
  }, [resolveCurrentIdentity, state.tasks]);

  const myCurrentTask = myAssignedTasks.length > 0 ? myAssignedTasks[0] : null;
  const prevMyTaskIdsRef = useRef<string[]>([]);

  useEffect(() => {
    const taskChannelIds = myAssignedTasks.map((t) => `task:${t.id}`);
    const desired = Array.from(new Set(['geral', ...taskChannelIds]));

    // Detecta se a atribuição de tarefas do operador mudou
    const currentTaskIds = myAssignedTasks.map((t) => t.id).sort();
    const prevTaskIds = [...prevMyTaskIdsRef.current].sort();
    const hasChanged =
      currentTaskIds.length !== prevTaskIds.length ||
      currentTaskIds.some((id, idx) => id !== prevTaskIds[idx]);

    if (hasChanged) {
      prevMyTaskIdsRef.current = myAssignedTasks.map((t) => t.id);
      if (myAssignedTasks.length > 0) {
        const primaryTask = myAssignedTasks[0];
        // Sincroniza canal ativo automaticamente para o canal da tarefa
        setActiveChannel(`task:${primaryTask.id}`);
        showNotice(
          `📻 Conectado ao canal da sua tarefa: "${primaryTask.name}". Fale com seus colegas de tarefa sem ocupar o canal Geral!`,
          'Mudar para Geral',
          () => setActiveChannel('geral'),
          'info'
        );
      } else {
        setActiveChannel('geral');
      }
    }

    setSubscribedChannels((prev) => {
      const directChs = prev.filter((c) => c.startsWith('direct:'));
      const combined = Array.from(new Set([...desired, ...directChs]));
      if (prev.length === combined.length && prev.every((val, index) => val === combined[index])) {
        return prev;
      }
      subscribedRef.current = combined;
      return combined;
    });

    if (!activeChannel) {
      setActiveChannel(myAssignedTasks.length > 0 ? `task:${myAssignedTasks[0].id}` : 'geral');
    }
  }, [myAssignedTasks, activeChannel, showNotice]);"""

text = text[:idx_start] + new_task_block + text[idx_end:]

# 4. Harmonize startLiveBroadcast & stopLiveBroadcast with mediaKeepalive
idx_stop = text.find("const stopLiveBroadcast = useCallback(() => {")
idx_start_live = text.find("const startLiveBroadcast = useCallback(() => {", idx_stop)
idx_end_live = text.find("}, []);", idx_start_live) + len("}, []);")

old_broadcast = text[idx_stop:idx_end_live]

new_broadcast = """const stopLiveBroadcast = useCallback(() => {
    mediaKeepalive.stop();
    if (keepaliveIntervalRef.current) {
      clearInterval(keepaliveIntervalRef.current);
      keepaliveIntervalRef.current = null;
    }
  }, []);

  // Background Live Broadcast Engine unificado com mediaKeepalive
  const startLiveBroadcast = useCallback(() => {
    if (!enabledRef.current) return;
    mediaKeepalive.start(activeChannelRef.current || 'Geral').then((ok) => {
      if (ok) setAudioBlocked(false);
    }).catch(() => {
      setAudioBlocked(true);
    });
    mediaKeepalive.ensurePlaying();
  }, []);"""

text = text[:idx_stop] + new_broadcast + text[idx_end_live:]

# 5. Fix notifications: only notify for DM (direct channel calls)
idx_notif = text.find("// If the app is minimized (background on Android), notify the operator immediately")
if idx_notif != -1:
    idx_notif_end = text.find("setRemotePeersMap((prev) => {", idx_notif)
    new_notif_block = """// Notifica APENAS em Canais Diretos (DM privado), evitando spam sonoro a cada toque no Geral
          if (msg.channel.startsWith('direct:') && typeof document !== 'undefined' && document.visibilityState === 'hidden') {
            const speaker = speakerName;
            showNativeOSNotification(`📞 Chamada Direta de ${speaker}`, {
              body: `${speaker} está falando com você em canal direto privado.`,
              tag: 'dimensio-radio-direct',
              vibrate: [300, 150, 300, 150, 300],
            });
          }
          """
    text = text[:idx_notif] + new_notif_block + text[idx_notif_end:]

# 6. Export myAssignedTasks & myCurrentTask in Provider value
old_val = """    toggleLoudspeaker,
    refreshAudioOutputDevices,
  };"""

new_val = """    toggleLoudspeaker,
    refreshAudioOutputDevices,
    myAssignedTasks,
    myCurrentTask,
  };"""

assert old_val in text, "old_val not found"
text = text.replace(old_val, new_val, 1)

with open('src/context/CommunicationContext.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print('Successfully patched CommunicationContext.tsx!')
