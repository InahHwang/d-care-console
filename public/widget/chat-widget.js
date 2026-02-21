/**
 * D-Care 채팅 위젯 (외부 사이트 삽입용)
 * 아임웹, 카페24, 기타 외부 사이트에서 스크립트로 삽입하여 사용
 */
(function() {
  'use strict';

  // ============================================
  // 설정 (동적으로 읽어서 로딩 순서 문제 해결)
  // ============================================
  function getConfig() {
    return {
      apiBaseUrl: window.DCARE_WIDGET_CONFIG?.apiBaseUrl || 'https://d-care-console.vercel.app',
      clinicName: window.DCARE_WIDGET_CONFIG?.clinicName || '채팅 상담',
      primaryColor: window.DCARE_WIDGET_CONFIG?.primaryColor || '#3B82F6',
      welcomeMessage: window.DCARE_WIDGET_CONFIG?.welcomeMessage || '안녕하세요! 무엇을 도와드릴까요?',
      position: window.DCARE_WIDGET_CONFIG?.position || 'bottom-right',
      pusherKey: window.DCARE_WIDGET_CONFIG?.pusherKey || '',
      pusherCluster: window.DCARE_WIDGET_CONFIG?.pusherCluster || 'ap3',
    };
  }

  // 호환성을 위해 CONFIG 유지 (초기화 시 읽음)
  let CONFIG = getConfig();

  // ============================================
  // 상태
  // ============================================
  let state = {
    isOpen: false,
    isMinimized: false,
    step: 'info', // 'info' | 'chat'
    chatId: null,
    sessionId: null,
    userName: '',
    userPhone: '',
    messages: [],
    isSending: false,
  };

  let pusher = null;
  let channel = null;

  // ============================================
  // 유틸리티
  // ============================================
  function generateSessionId() {
    return 'web_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  function formatPhone(value) {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return numbers.slice(0, 3) + '-' + numbers.slice(3);
    return numbers.slice(0, 3) + '-' + numbers.slice(3, 7) + '-' + numbers.slice(7, 11);
  }

  function formatTime(dateString) {
    const date = new Date(dateString);
    return date.getHours().toString().padStart(2, '0') + ':' +
           date.getMinutes().toString().padStart(2, '0');
  }

  function saveSession() {
    localStorage.setItem('dcare-chat-session', JSON.stringify({
      sessionId: state.sessionId,
      chatId: state.chatId,
      userName: state.userName,
      userPhone: state.userPhone,
    }));
  }

  function loadSession() {
    try {
      const saved = localStorage.getItem('dcare-chat-session');
      if (saved) {
        const data = JSON.parse(saved);
        state.sessionId = data.sessionId;
        state.chatId = data.chatId;
        state.userName = data.userName || '';
        state.userPhone = data.userPhone || '';
        if (data.chatId) {
          state.step = 'chat';
          loadMessages();
        }
      }
    } catch (e) {
      console.error('세션 로드 실패:', e);
    }

    if (!state.sessionId) {
      state.sessionId = generateSessionId();
    }
  }

  // ============================================
  // API
  // ============================================
  async function startChat() {
    if (!state.userName.trim() || !state.userPhone.trim()) {
      alert('이름과 연락처를 입력해주세요.');
      return;
    }

    // 동적으로 config 다시 읽기 (로딩 순서 문제 해결)
    CONFIG = getConfig();

    try {
      const res = await fetch(CONFIG.apiBaseUrl + '/api/v2/webhooks/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'start',
          sessionId: state.sessionId,
          customerName: state.userName,
          customerPhone: state.userPhone,
        }),
      });

      const data = await res.json();
      if (data.success) {
        state.chatId = data.chatId;
        state.step = 'chat';
        state.messages = [{
          id: 'welcome',
          content: CONFIG.welcomeMessage,
          senderType: 'system',
          createdAt: new Date().toISOString(),
        }];
        saveSession();
        connectPusher();
        render();
      }
    } catch (error) {
      console.error('채팅 시작 실패:', error);
      alert('연결에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
  }

  async function sendMessage() {
    const input = document.getElementById('dcare-chat-input');
    const content = input.value.trim();
    if (!content || state.isSending) return;

    input.value = '';
    state.isSending = true;
    CONFIG = getConfig(); // config 갱신

    // 낙관적 업데이트
    const tempId = 'temp_' + Date.now();
    state.messages.push({
      id: tempId,
      content: content,
      senderType: 'customer',
      createdAt: new Date().toISOString(),
    });
    renderMessages();

    try {
      const res = await fetch(CONFIG.apiBaseUrl + '/api/v2/webhooks/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'message',
          sessionId: state.sessionId,
          chatId: state.chatId,
          content: content,
        }),
      });

      const data = await res.json();
      if (data.success && data.message) {
        // 임시 메시지 교체
        const idx = state.messages.findIndex(m => m.id === tempId);
        if (idx !== -1) {
          state.messages[idx] = { ...data.message, senderType: 'customer' };
        }
      }
    } catch (error) {
      console.error('메시지 전송 실패:', error);
      state.messages = state.messages.filter(m => m.id !== tempId);
      alert('메시지 전송에 실패했습니다.');
    } finally {
      state.isSending = false;
      renderMessages();
    }
  }

  async function loadMessages() {
    if (!state.chatId) return;
    CONFIG = getConfig(); // config 갱신

    try {
      const res = await fetch(CONFIG.apiBaseUrl + '/api/v2/channel-chats/' + state.chatId + '/messages');
      const data = await res.json();
      if (data.success) {
        state.messages = data.data?.messages || [];
        renderMessages();
        connectPusher();
      }
    } catch (error) {
      console.error('메시지 로드 실패:', error);
    }
  }

  // ============================================
  // Pusher (실시간)
  // ============================================
  function connectPusher() {
    console.log('[D-Care Widget] connectPusher called', { pusherKey: CONFIG.pusherKey, chatId: state.chatId, pusherExists: !!pusher });
    if (!CONFIG.pusherKey || !state.chatId || pusher) return;

    // Pusher 스크립트 로드
    if (!window.Pusher) {
      console.log('[D-Care Widget] Loading Pusher script...');
      const script = document.createElement('script');
      script.src = 'https://js.pusher.com/8.2.0/pusher.min.js';
      script.onload = function() {
        console.log('[D-Care Widget] Pusher script loaded');
        initPusher();
      };
      document.head.appendChild(script);
    } else {
      initPusher();
    }
  }

  function initPusher() {
    console.log('[D-Care Widget] initPusher called');
    pusher = new window.Pusher(CONFIG.pusherKey, {
      cluster: CONFIG.pusherCluster,
    });

    channel = pusher.subscribe('channel-chat-v2');
    console.log('[D-Care Widget] Subscribed to channel-chat-v2');

    channel.bind('new-message', function(data) {
      console.log('[D-Care Widget] Received new-message event:', data);
      console.log('[D-Care Widget] Current chatId:', state.chatId, 'Event chatId:', data.chatId);
      if (data.chatId === state.chatId) {
        // 고객이 보낸 메시지는 이미 로컬에 추가됨 (낙관적 업데이트) - 무시
        if (data.message.senderType === 'customer') {
          console.log('[D-Care Widget] Ignoring customer message (already added locally)');
          return;
        }
        // 중복 방지 후 추가
        if (!state.messages.some(m => m.id === data.message.id)) {
          console.log('[D-Care Widget] Adding agent message to chat');
          state.messages.push(data.message);
          renderMessages();
          scrollToBottom();
        }
      }
    });

    pusher.connection.bind('connected', function() {
      console.log('[D-Care Widget] Pusher connected!');
    });

    pusher.connection.bind('error', function(err) {
      console.error('[D-Care Widget] Pusher connection error:', err);
    });
  }

  // ============================================
  // 렌더링
  // ============================================
  function render() {
    const container = document.getElementById('dcare-chat-widget');
    if (!container) return;

    // 위치 설정
    let positionStyle = '';
    switch (CONFIG.position) {
      case 'bottom-left':
        positionStyle = 'bottom: 24px; left: 24px;';
        break;
      case 'top-right':
        positionStyle = 'top: 24px; right: 24px;';
        break;
      case 'top-left':
        positionStyle = 'top: 24px; left: 24px;';
        break;
      default: // bottom-right
        positionStyle = 'bottom: 24px; right: 24px;';
    }
    const isTop = CONFIG.position.startsWith('top');

    let html = '<div style="position: fixed; ' + positionStyle + ' z-index: 999999; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif; display: flex; flex-direction: ' + (isTop ? 'column' : 'column-reverse') + '; align-items: ' + (CONFIG.position.includes('left') ? 'flex-start' : 'flex-end') + ';">';

    // 채팅 창
    if (state.isOpen && !state.isMinimized) {
      html += renderChatWindow();
    }

    // 최소화 버튼
    if (state.isOpen && state.isMinimized) {
      html += '<button onclick="window.dcareWidget.restore()" style="margin: 8px 0; padding: 8px 16px; background: white; border-radius: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: none; cursor: pointer; display: flex; align-items: center; gap: 8px;">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="' + CONFIG.primaryColor + '" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>' +
        '<span style="font-size: 14px; color: #374151;">채팅 계속하기</span></button>';
    }

    // 플로팅 버튼
    if (!state.isOpen) {
      html += '<button onclick="window.dcareWidget.open()" style="width: 56px; height: 56px; border-radius: 50%; background: ' + CONFIG.primaryColor + '; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; transition: transform 0.2s;" onmouseover="this.style.transform=\'scale(1.05)\'" onmouseout="this.style.transform=\'scale(1)\'">' +
        '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg></button>';
    }

    html += '</div>';
    container.innerHTML = html;

    if (state.isOpen && !state.isMinimized && state.step === 'chat') {
      scrollToBottom();
    }
  }

  function renderChatWindow() {
    let html = '<div style="margin-bottom: 16px; width: 360px; height: 520px; background: white; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.2); overflow: hidden; display: flex; flex-direction: column;">';

    // 헤더
    html += '<div style="padding: 12px 16px; background: ' + CONFIG.primaryColor + '; color: white; display: flex; align-items: center; justify-content: space-between;">' +
      '<div style="display: flex; align-items: center; gap: 8px;">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>' +
        '<span style="font-weight: 500;">' + CONFIG.clinicName + '</span>' +
      '</div>' +
      '<div style="display: flex; gap: 4px;">' +
        '<button onclick="window.dcareWidget.minimize()" style="padding: 6px; background: rgba(255,255,255,0.2); border: none; border-radius: 8px; cursor: pointer; color: white;">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>' +
        '</button>' +
        '<button onclick="window.dcareWidget.close()" style="padding: 6px; background: rgba(255,255,255,0.2); border: none; border-radius: 8px; cursor: pointer; color: white;">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
        '</button>' +
      '</div>' +
    '</div>';

    // 내용
    if (state.step === 'info') {
      html += renderInfoStep();
    } else {
      html += renderChatStep();
    }

    html += '</div>';
    return html;
  }

  function renderInfoStep() {
    return '<div style="flex: 1; padding: 24px; display: flex; flex-direction: column;">' +
      '<div style="text-align: center; margin-bottom: 24px;">' +
        '<div style="width: 64px; height: 64px; margin: 0 auto 16px; background: ' + CONFIG.primaryColor + '20; border-radius: 50%; display: flex; align-items: center; justify-content: center;">' +
          '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="' + CONFIG.primaryColor + '" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>' +
        '</div>' +
        '<h3 style="font-size: 18px; font-weight: bold; color: #111827; margin: 0 0 8px;">상담 시작하기</h3>' +
        '<p style="font-size: 14px; color: #6B7280; margin: 0;">간단한 정보를 입력하시면<br>상담사가 빠르게 연결됩니다.</p>' +
      '</div>' +
      '<div style="flex: 1;">' +
        '<div style="margin-bottom: 16px;">' +
          '<label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 4px;">이름 <span style="color: #EF4444;">*</span></label>' +
          '<input type="text" id="dcare-name" value="' + state.userName + '" placeholder="홍길동" style="width: 100%; padding: 12px 16px; border: 1px solid #E5E7EB; border-radius: 12px; font-size: 14px; outline: none; box-sizing: border-box;" onfocus="this.style.borderColor=\'' + CONFIG.primaryColor + '\'" onblur="this.style.borderColor=\'#E5E7EB\'">' +
        '</div>' +
        '<div style="margin-bottom: 16px;">' +
          '<label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 4px;">연락처 <span style="color: #EF4444;">*</span></label>' +
          '<input type="tel" id="dcare-phone" value="' + state.userPhone + '" placeholder="010-1234-5678" style="width: 100%; padding: 12px 16px; border: 1px solid #E5E7EB; border-radius: 12px; font-size: 14px; outline: none; box-sizing: border-box;" onfocus="this.style.borderColor=\'' + CONFIG.primaryColor + '\'" onblur="this.style.borderColor=\'#E5E7EB\'" oninput="this.value=window.dcareWidget.formatPhone(this.value)">' +
        '</div>' +
      '</div>' +
      '<button onclick="window.dcareWidget.start()" style="width: 100%; padding: 12px; background: ' + CONFIG.primaryColor + '; color: white; border: none; border-radius: 12px; font-size: 15px; font-weight: 500; cursor: pointer;">상담 시작하기</button>' +
      '<p style="font-size: 12px; color: #9CA3AF; text-align: center; margin-top: 12px;">상담 내용은 서비스 개선을 위해 저장될 수 있습니다.</p>' +
    '</div>';
  }

  function renderChatStep() {
    return '<div id="dcare-messages" style="flex: 1; overflow-y: auto; padding: 16px;">' +
      state.messages.map(function(msg) {
        if (msg.senderType === 'system') {
          return '<div style="display: flex; justify-content: center; margin-bottom: 12px;">' +
            '<div style="background: #F3F4F6; color: #6B7280; font-size: 14px; padding: 8px 16px; border-radius: 12px;">' + msg.content + '</div>' +
          '</div>';
        }
        const isCustomer = msg.senderType === 'customer';
        return '<div style="display: flex; justify-content: ' + (isCustomer ? 'flex-end' : 'flex-start') + '; margin-bottom: 12px;">' +
          '<div style="max-width: 85%; background: ' + (isCustomer ? CONFIG.primaryColor : '#F3F4F6') + '; color: ' + (isCustomer ? 'white' : '#111827') + '; padding: 10px 14px; border-radius: 16px; ' + (isCustomer ? 'border-bottom-right-radius: 4px;' : 'border-bottom-left-radius: 4px;') + '">' +
            '<p style="font-size: 14px; margin: 0 0 4px; white-space: pre-wrap;">' + msg.content + '</p>' +
            '<p style="font-size: 11px; margin: 0; opacity: 0.7;">' + formatTime(msg.createdAt) + '</p>' +
          '</div>' +
        '</div>';
      }).join('') +
    '</div>' +
    '<div style="padding: 12px; border-top: 1px solid #E5E7EB; background: #F9FAFB;">' +
      '<div style="display: flex; gap: 8px;">' +
        '<input type="text" id="dcare-chat-input" placeholder="메시지를 입력하세요..." style="flex: 1; padding: 10px 14px; border: 1px solid #E5E7EB; border-radius: 12px; font-size: 14px; outline: none;" onkeypress="if(event.key===\'Enter\')window.dcareWidget.send()">' +
        '<button onclick="window.dcareWidget.send()" style="padding: 10px; background: ' + CONFIG.primaryColor + '; color: white; border: none; border-radius: 12px; cursor: pointer;">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>' +
        '</button>' +
      '</div>' +
    '</div>';
  }

  function renderMessages() {
    const container = document.getElementById('dcare-messages');
    if (!container) return;

    container.innerHTML = state.messages.map(function(msg) {
      if (msg.senderType === 'system') {
        return '<div style="display: flex; justify-content: center; margin-bottom: 12px;">' +
          '<div style="background: #F3F4F6; color: #6B7280; font-size: 14px; padding: 8px 16px; border-radius: 12px;">' + msg.content + '</div>' +
        '</div>';
      }
      const isCustomer = msg.senderType === 'customer';
      return '<div style="display: flex; justify-content: ' + (isCustomer ? 'flex-end' : 'flex-start') + '; margin-bottom: 12px;">' +
        '<div style="max-width: 85%; background: ' + (isCustomer ? CONFIG.primaryColor : '#F3F4F6') + '; color: ' + (isCustomer ? 'white' : '#111827') + '; padding: 10px 14px; border-radius: 16px; ' + (isCustomer ? 'border-bottom-right-radius: 4px;' : 'border-bottom-left-radius: 4px;') + '">' +
          '<p style="font-size: 14px; margin: 0 0 4px; white-space: pre-wrap;">' + msg.content + '</p>' +
          '<p style="font-size: 11px; margin: 0; opacity: 0.7;">' + formatTime(msg.createdAt) + '</p>' +
        '</div>' +
      '</div>';
    }).join('');

    scrollToBottom();
  }

  function scrollToBottom() {
    const container = document.getElementById('dcare-messages');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  // ============================================
  // 초기화
  // ============================================
  function init() {
    // 컨테이너 생성
    const container = document.createElement('div');
    container.id = 'dcare-chat-widget';
    document.body.appendChild(container);

    // 세션 로드
    loadSession();

    // 렌더링
    render();
  }

  // ============================================
  // 전역 API
  // ============================================
  window.dcareWidget = {
    open: function() {
      state.isOpen = true;
      state.isMinimized = false;
      render();
    },
    close: function() {
      state.isOpen = false;
      render();
    },
    minimize: function() {
      state.isMinimized = true;
      render();
    },
    restore: function() {
      state.isMinimized = false;
      render();
    },
    start: function() {
      state.userName = document.getElementById('dcare-name').value;
      state.userPhone = document.getElementById('dcare-phone').value;
      startChat();
    },
    send: sendMessage,
    formatPhone: formatPhone,
  };

  // DOM 로드 후 초기화
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
