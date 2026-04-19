class SistemaSenhasFirebase {
    constructor() {
        this.isTotemPage = document.body.classList.contains('totem-page');
        this.isDisplayPage = document.body.classList.contains('display-page');
        this.isControlePage = document.body.classList.contains('controle-page');
        
        this.database = firebase.database();
        this.guicheId = this.gerarGuicheId();
        
        this.categorias = [];
        this.fila = [];
        this.senhaAtual = null;
        this.historico = [];
        this.estatisticas = {};
        this.configuracoes = {
            guiche: '01',
            atendente: 'Atendente 01'
        };
        
        this.timerAtendimento = null;
        this.tempoAtendimento = 0;
        
        this.iniciar();
    }

    gerarGuicheId() {
        let id = localStorage.getItem('guicheId');
        if (!id) {
            id = 'guiche_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('guicheId', id);
        }
        return id;
    }

    async iniciar() {
        console.log('🚀 Iniciando sistema...');
        this.configurarListeners();
        this.monitorarConexao();
        
        if (this.isTotemPage) {
            this.iniciarTotem();
        } else if (this.isDisplayPage) {
            this.iniciarDisplay();
        } else if (this.isControlePage) {
            this.iniciarControle();
            this.registrarGuicheAtivo();
        }
        
        if (this.isControlePage) {
            this.configurarPresenca();
        }
    }

    configurarListeners() {
        this.database.ref('categorias').on('value', (snapshot) => {
            this.categorias = snapshot.val() || this.getCategoriasPadrao();
            if (!snapshot.val()) {
                this.salvarCategorias();
            }
            this.renderizarInterface();
        });

        this.database.ref('fila').on('value', (snapshot) => {
            this.fila = snapshot.val() || [];
            this.fila = this.fila.filter(item => item !== null);
            this.renderizarInterface();
        });

        this.database.ref('senhaAtual').on('value', (snapshot) => {
            this.senhaAtual = snapshot.val();
            this.renderizarInterface();
            
            if (this.isDisplayPage && this.senhaAtual) {
                this.anunciarSenha(this.senhaAtual);
            }
        });

        this.database.ref('historico').on('value', (snapshot) => {
            this.historico = snapshot.val() || [];
            this.historico = this.historico.filter(item => item !== null);
            this.renderizarInterface();
        });

        this.database.ref('estatisticas').on('value', (snapshot) => {
            this.estatisticas = snapshot.val() || this.getEstatisticasPadrao();
            this.renderizarInterface();
        });
    }

    getCategoriasPadrao() {
        return [
            { id: '1', nome: 'Geral', cor: '#3498db', icone: '🎫', contador: 0 },
            { id: '2', nome: 'Prioridade', cor: '#e74c3c', icone: '⭐', contador: 0 },
            { id: '3', nome: 'Agendado', cor: '#2ecc71', icone: '📅', contador: 0 }
        ];
    }

    getEstatisticasPadrao() {
        return {
            atendidosHoje: 0,
            tempoTotalAtendimento: 0,
            dataInicio: new Date().toDateString()
        };
    }

    monitorarConexao() {
        const connectedRef = this.database.ref('.info/connected');
        connectedRef.on('value', (snap) => {
            const statusEl = document.getElementById('connectionStatus');
            if (!statusEl) return;
            
            if (snap.val() === true) {
                statusEl.innerHTML = `
                    <span class="status-dot connected"></span>
                    <span class="status-text">Conectado</span>
                `;
            } else {
                statusEl.innerHTML = `
                    <span class="status-dot disconnected"></span>
                    <span class="status-text">Desconectado</span>
                `;
            }
        });
    }

    configurarPresenca() {
        const guicheRef = this.database.ref(`guiches/${this.guicheId}`);
        
        guicheRef.set({
            id: this.guicheId,
            numero: this.configuracoes.guiche,
            atendente: this.configuracoes.atendente,
            ultimoAcesso: firebase.database.ServerValue.TIMESTAMP
        });

        guicheRef.onDisconnect().remove();

        setInterval(() => {
            guicheRef.update({
                ultimoAcesso: firebase.database.ServerValue.TIMESTAMP
            });
        }, 30000);

        this.database.ref('guiches').on('value', (snapshot) => {
            this.renderizarGuichesAtivos(snapshot.val());
        });
    }

    renderizarGuichesAtivos(guiches) {
        const container = document.getElementById('guichesAtivos');
        if (!container) return;
        
        if (!guiches) {
            container.innerHTML = '';
            return;
        }
        
        const guichesAtivos = Object.values(guiches);
        container.innerHTML = guichesAtivos.map(g => `
            <span class="guiche-badge" title="${g.atendente}">
                Guichê ${g.numero}
            </span>
        `).join('');
    }

    async salvarCategorias() {
        await this.database.ref('categorias').set(this.categorias);
    }

    async salvarFila() {
        await this.database.ref('fila').set(this.fila);
    }

    async salvarSenhaAtual() {
        await this.database.ref('senhaAtual').set(this.senhaAtual);
    }

    async salvarHistorico() {
        await this.database.ref('historico').set(this.historico.slice(0, 100));
    }

    async salvarEstatisticas() {
        await this.database.ref('estatisticas').set(this.estatisticas);
    }

    // ============ TOTEM ============
    iniciarTotem() {
        this.renderizarTotem();
        this.iniciarRelogio('relogioTotem');
    }

    renderizarTotem() {
        this.renderizarCategoriasTotem();
        this.atualizarInfoFila();
    }

    renderizarCategoriasTotem() {
        const container = document.getElementById('categoriasTotem');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!this.categorias || this.categorias.length === 0) {
            container.innerHTML = '<p style="color: white; text-align: center;">Nenhuma categoria disponível</p>';
            return;
        }
        
        this.categorias.forEach(categoria => {
            const card = document.createElement('div');
            card.className = 'categoria-totem-card';
            card.onclick = () => this.gerarSenhaTotem(categoria.id);
            
            const filaCategoria = this.fila.filter(s => s.categoriaId === categoria.id).length;
            
            card.innerHTML = `
                <div class="categoria-totem-icone">${categoria.icone}</div>
                <div class="categoria-totem-nome">${categoria.nome}</div>
                <div class="categoria-totem-espera">
                    ${filaCategoria} pessoa${filaCategoria !== 1 ? 's' : ''} na fila
                </div>
            `;
            
            container.appendChild(card);
        });
    }

    async gerarSenhaTotem(categoriaId) {
        const categoria = this.categorias.find(c => c.id === categoriaId);
        if (!categoria) return;
        
        categoria.contador = (categoria.contador || 0) + 1;
        
        const numeroSenha = `${categoria.nome.charAt(0).toUpperCase()}${String(categoria.contador).padStart(3, '0')}`;
        
        const senha = {
            id: Date.now() + '_' + Math.random().toString(36),
            numero: numeroSenha,
            categoriaId: categoria.id,
            categoriaNome: categoria.nome,
            categoriaCor: categoria.cor,
            categoriaIcone: categoria.icone,
            horarioGeracao: new Date().toISOString(),
            status: 'aguardando',
            origem: 'totem'
        };
        
        this.fila.push(senha);
        
        await Promise.all([
            this.salvarCategorias(),
            this.salvarFila()
        ]);
        
        document.getElementById('categoriasTotem').style.display = 'none';
        document.getElementById('ultimaSenhaGerada').style.display = 'block';
        document.getElementById('totemActions').style.display = 'block';
        
        document.getElementById('senhaGeradaNumero').textContent = senha.numero;
        const categoriaEl = document.getElementById('senhaGeradaCategoria');
        categoriaEl.textContent = senha.categoriaNome;
        categoriaEl.style.backgroundColor = senha.categoriaCor;
    }

    mostrarCategorias() {
        document.getElementById('categoriasTotem').style.display = 'grid';
        document.getElementById('ultimaSenhaGerada').style.display = 'none';
        document.getElementById('totemActions').style.display = 'none';
        this.renderizarCategoriasTotem();
    }

    novaSenha() {
        this.mostrarCategorias();
    }

    atualizarInfoFila() {
        const totalFilaEl = document.getElementById('totalFilaTotem');
        const tempoMedioEl = document.getElementById('tempoMedioTotem');
        
        if (totalFilaEl) {
            totalFilaEl.textContent = this.fila.length;
        }
        
        if (tempoMedioEl) {
            tempoMedioEl.textContent = this.calcularTempoMedioEspera();
        }
    }

    // ============ DISPLAY ============
    iniciarDisplay() {
        this.renderizarDisplay();
        this.iniciarRelogio('displayRelogio');
    }

    renderizarDisplay() {
        this.renderizarSenhaAtualDisplay();
        this.renderizarProximasSenhas();
        this.renderizarHistoricoDisplay();
    }

    renderizarSenhaAtualDisplay() {
        const numeroEl = document.getElementById('displayNumero');
        const categoriaEl = document.getElementById('displayCategoria');
        const guicheEl = document.getElementById('displayGuiche');
        const container = document.getElementById('senhaAtualDisplay');

        if (this.senhaAtual) {
            numeroEl.textContent = this.senhaAtual.numero;
            categoriaEl.textContent = this.senhaAtual.categoriaNome;
            categoriaEl.style.backgroundColor = this.senhaAtual.categoriaCor;
            guicheEl.textContent = `GUICHÊ ${this.senhaAtual.guiche || '--'}`;
        } else {
            numeroEl.textContent = '---';
            categoriaEl.textContent = '';
            guicheEl.textContent = '';
        }
    }

    renderizarProximasSenhas() {
        const container = document.getElementById('proximasSenhasGrid');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.fila.slice(0, 6).forEach(senha => {
            const item = document.createElement('div');
            item.className = 'proxima-senha-item';
            
            item.innerHTML = `
                <div class="proxima-senha-numero">${senha.numero}</div>
                <div class="proxima-senha-categoria" style="background-color: ${senha.categoriaCor}">
                    ${senha.categoriaIcone} ${senha.categoriaNome}
                </div>
            `;
            
            container.appendChild(item);
        });
    }

    renderizarHistoricoDisplay() {
        const container = document.getElementById('historicoDisplay');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.historico.slice(0, 8).forEach(item => {
            const div = document.createElement('div');
            div.className = 'historico-display-item';
            
            div.innerHTML = `
                <span class="historico-display-senha">${item.numero}</span>
                <span class="historico-display-categoria" style="background-color: ${item.categoriaCor}">
                    ${item.categoriaIcone || ''} ${item.categoriaNome}
                </span>
                <span class="historico-display-guiche">Guichê ${item.guiche || '--'}</span>
            `;
            
            container.appendChild(div);
        });
    }

    // ============ CONTROLE ============
    iniciarControle() {
        console.log('✅ Iniciando painel de controle');
        this.renderizarControle();
        this.configurarEventosControle();
        this.iniciarTimerAtendimento();
    }

    registrarGuicheAtivo() {
        const select = document.getElementById('guicheSelect');
        if (select) {
            select.value = this.configuracoes.guiche;
        }
    }

    renderizarControle() {
        this.renderizarFilaControle();
        this.renderizarCategoriasControle();
        this.renderizarAtendimentoAtual();
        this.renderizarHistoricoControle();
        this.renderizarEstatisticas();
    }

    renderizarFilaControle() {
        const container = document.getElementById('filaList');
        const contadorEl = document.getElementById('filaContador');
        
        if (!container) return;
        
        container.innerHTML = '';
        contadorEl.textContent = `${this.fila.length} senha${this.fila.length !== 1 ? 's' : ''}`;
        
        if (this.fila.length === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">Fila vazia</div>';
            return;
        }
        
        this.fila.forEach(senha => {
            const item = document.createElement('div');
            item.className = 'fila-item';
            
            item.innerHTML = `
                <span class="fila-senha">${senha.numero}</span>
                <span class="fila-categoria-badge" style="background-color: ${senha.categoriaCor}">
                    ${senha.categoriaIcone || ''} ${senha.categoriaNome}
                </span>
                <span class="fila-guiche">-</span>
                <div class="fila-acoes">
                    <button class="btn-outline btn-small" onclick="sistema.chamarSenhaEspecifica('${senha.id}')">
                        Chamar
                    </button>
                    <button class="btn-danger btn-small" onclick="sistema.removerDaFila('${senha.id}')">
                        ✕
                    </button>
                </div>
            `;
            
            container.appendChild(item);
        });
    }

    renderizarCategoriasControle() {
        const container = document.getElementById('categoriasControle');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!this.categorias || this.categorias.length === 0) {
            container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">Nenhuma categoria. Clique em "Gerenciar".</p>';
            return;
        }
        
        this.categorias.forEach(categoria => {
            const item = document.createElement('div');
            item.className = 'categoria-controle-item';
            item.style.backgroundColor = categoria.cor;
            
            const filaCategoria = this.fila.filter(s => s.categoriaId === categoria.id).length;
            
            item.innerHTML = `
                <div class="categoria-controle-header">
                    <span class="categoria-controle-nome">
                        ${categoria.icone} ${categoria.nome}
                    </span>
                    <span class="categoria-controle-contador">${categoria.contador || 0}</span>
                </div>
                <div class="categoria-controle-status">
                    ${filaCategoria} na fila
                </div>
            `;
            
            container.appendChild(item);
        });
    }

    renderizarAtendimentoAtual() {
        const vazioEl = document.getElementById('atendimentoVazio');
        const infoEl = document.getElementById('atendimentoInfo');
        
        if (this.senhaAtual) {
            vazioEl.style.display = 'none';
            infoEl.style.display = 'block';
            
            document.getElementById('senhaAtualGrande').textContent = this.senhaAtual.numero;
            document.getElementById('categoriaAtual').textContent = `${this.senhaAtual.categoriaIcone || ''} ${this.senhaAtual.categoriaNome}`;
            document.getElementById('categoriaAtual').style.backgroundColor = this.senhaAtual.categoriaCor;
            document.getElementById('guicheAtual').textContent = `Guichê ${this.senhaAtual.guiche || this.configuracoes.guiche}`;
            
            document.getElementById('chamarProximaBtn').style.display = 'none';
            document.getElementById('finalizarAtendimentoBtn').style.display = 'block';
        } else {
            vazioEl.style.display = 'block';
            infoEl.style.display = 'none';
            
            document.getElementById('chamarProximaBtn').style.display = 'block';
            document.getElementById('finalizarAtendimentoBtn').style.display = 'none';
        }
    }

    renderizarHistoricoControle() {
        const container = document.getElementById('historicoControle');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.historico.slice(0, 10).forEach(item => {
            const div = document.createElement('div');
            div.className = 'historico-controle-item';
            
            const hora = item.horarioChamada ? new Date(item.horarioChamada).toLocaleTimeString() : '--:--';
            
            div.innerHTML = `
                <span><strong>${item.numero}</strong> - ${item.categoriaNome}</span>
                <span>Guichê ${item.guiche || '--'}</span>
                <span style="color: #999;">${hora}</span>
            `;
            
            container.appendChild(div);
        });
    }

    renderizarEstatisticas() {
        document.getElementById('totalAtendidos').textContent = this.estatisticas.atendidosHoje || 0;
        document.getElementById('naFila').textContent = this.fila.length;
        document.getElementById('tempoMedioAtendimento').textContent = this.calcularTempoMedioAtendimento();
    }

    // ============ AÇÕES DE CONTROLE ============
    async chamarProximaSenha() {
        if (this.fila.length === 0) {
            alert('Não há senhas na fila!');
            return;
        }

        if (this.senhaAtual) {
            await this.finalizarAtendimento(false);
        }

        const proximaSenha = this.fila.shift();
        proximaSenha.status = 'atendida';
        proximaSenha.horarioChamada = new Date().toISOString();
        proximaSenha.guiche = this.configuracoes.guiche;
        proximaSenha.atendente = this.configuracoes.atendente;
        
        this.senhaAtual = proximaSenha;
        this.historico.unshift(proximaSenha);
        this.estatisticas.atendidosHoje = (this.estatisticas.atendidosHoje || 0) + 1;
        
        await Promise.all([
            this.salvarFila(),
            this.salvarSenhaAtual(),
            this.salvarHistorico(),
            this.salvarEstatisticas()
        ]);
        
        this.iniciarTimerAtendimento();
        this.anunciarSenha(proximaSenha);
        this.renderizarControle();
    }

    async chamarSenhaEspecifica(senhaId) {
        const index = this.fila.findIndex(s => s.id === senhaId);
        if (index === -1) return;
        
        if (this.senhaAtual) {
            await this.finalizarAtendimento(false);
        }
        
        const senha = this.fila.splice(index, 1)[0];
        senha.status = 'atendida';
        senha.horarioChamada = new Date().toISOString();
        senha.guiche = this.configuracoes.guiche;
        senha.atendente = this.configuracoes.atendente;
        
        this.senhaAtual = senha;
        this.historico.unshift(senha);
        this.estatisticas.atendidosHoje = (this.estatisticas.atendidosHoje || 0) + 1;
        
        await Promise.all([
            this.salvarFila(),
            this.salvarSenhaAtual(),
            this.salvarHistorico(),
            this.salvarEstatisticas()
        ]);
        
        this.iniciarTimerAtendimento();
        this.anunciarSenha(senha);
        this.renderizarControle();
    }

    async finalizarAtendimento(renderizar = true) {
        if (!this.senhaAtual) return;
        
        this.senhaAtual = null;
        clearInterval(this.timerAtendimento);
        this.tempoAtendimento = 0;
        
        await this.salvarSenhaAtual();
        
        if (renderizar) {
            this.renderizarControle();
        }
    }

    async removerDaFila(senhaId) {
        if (confirm('Remover esta senha da fila?')) {
            this.fila = this.fila.filter(s => s.id !== senhaId);
            await this.salvarFila();
            this.renderizarControle();
        }
    }

    // ============ CATEGORIAS ============
    async adicionarCategoria(nome, cor, icone) {
        const categoria = {
            id: Date.now().toString(),
            nome: nome,
            cor: cor,
            icone: icone,
            contador: 0
        };
        
        this.categorias.push(categoria);
        await this.salvarCategorias();
        this.renderizarControle();
    }

    async removerCategoria(id) {
        if (this.categorias.length <= 1) {
            alert('É necessário ter pelo menos uma categoria!');
            return;
        }
        
        this.categorias = this.categorias.filter(c => c.id !== id);
        await this.salvarCategorias();
        this.renderizarControle();
    }

    // ============ UTILITÁRIOS ============
    iniciarRelogio(elementId) {
        const el = document.getElementById(elementId);
        if (!el) return;
        
        const atualizar = () => {
            el.textContent = new Date().toLocaleTimeString('pt-BR');
        };
        
        atualizar();
        setInterval(atualizar, 1000);
    }

    iniciarTimerAtendimento() {
        clearInterval(this.timerAtendimento);
        this.tempoAtendimento = 0;
        
        if (this.senhaAtual) {
            this.timerAtendimento = setInterval(() => {
                this.tempoAtendimento++;
                const timerEl = document.getElementById('timerAtual');
                if (timerEl) {
                    timerEl.textContent = this.formatarTempo(this.tempoAtendimento * 1000);
                }
            }, 1000);
        }
    }

    calcularTempoMedioAtendimento() {
        if (!this.estatisticas.atendidosHoje || this.estatisticas.atendidosHoje === 0) return '00:00';
        const media = (this.estatisticas.tempoTotalAtendimento || 0) / this.estatisticas.atendidosHoje;
        return this.formatarTempo(media);
    }

    calcularTempoMedioEspera() {
        if (!this.estatisticas.atendidosHoje || this.estatisticas.atendidosHoje === 0 || this.fila.length === 0) return '--:--';
        const tempoMedioAtendimento = (this.estatisticas.tempoTotalAtendimento || 0) / this.estatisticas.atendidosHoje;
        const tempoEstimado = (tempoMedioAtendimento * this.fila.length) / 1000;
        return this.formatarTempo(tempoEstimado * 1000);
    }

    formatarTempo(milissegundos) {
        const segundos = Math.floor(milissegundos / 1000);
        const minutos = Math.floor(segundos / 60);
        const segs = segundos % 60;
        return `${String(minutos).padStart(2, '0')}:${String(segs).padStart(2, '0')}`;
    }

    ajustarCor(cor, percentual) {
        const num = parseInt(cor.replace('#', ''), 16);
        const r = (num >> 16) + percentual;
        const g = ((num >> 8) & 0x00FF) + percentual;
        const b = (num & 0x0000FF) + percentual;
        
        const novaCor = (1 << 24) + 
            (Math.min(255, Math.max(0, r)) << 16) + 
            (Math.min(255, Math.max(0, g)) << 8) + 
            Math.min(255, Math.max(0, b));
        
        return '#' + novaCor.toString(16).slice(1);
    }

    anunciarSenha(senha) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(
                `Senha ${senha.numero}, dirija-se ao guichê ${senha.guiche || this.configuracoes.guiche}`
            );
            utterance.lang = 'pt-BR';
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
        }
    }

    // ============ CONFIGURAÇÕES E EVENTOS ============
    configurarEventosControle() {
        console.log('Configurando eventos do controle...');
        
        document.getElementById('chamarProximaBtn').onclick = () => this.chamarProximaSenha();
        document.getElementById('finalizarAtendimentoBtn').onclick = () => this.finalizarAtendimento(true);
        
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !e.target.matches('input, button, select')) {
                e.preventDefault();
                if (this.senhaAtual) {
                    this.finalizarAtendimento(true);
                } else {
                    this.chamarProximaSenha();
                }
            }
        });
        
        document.getElementById('abrirDisplayBtn').onclick = () => {
            window.open('display.html', '_blank');
        };
        
        document.getElementById('abrirTotemBtn').onclick = () => {
            window.open('totem.html', '_blank');
        };
        
        document.getElementById('guicheSelect').onchange = (e) => {
            this.configuracoes.guiche = e.target.value;
            this.atualizarGuiche();
        };
        
        document.getElementById('atendenteNome').onchange = (e) => {
            this.configuracoes.atendente = e.target.value;
            this.atualizarGuiche();
        };
        
        // Configurar modal de categorias
        this.configurarModalCategorias();
        
        document.getElementById('resetarSistemaBtn').onclick = () => this.resetarSistema();
        
        document.getElementById('limparHistoricoBtn').onclick = () => {
            if (confirm('Limpar histórico de hoje?')) {
                this.historico = [];
                this.salvarHistorico();
                this.renderizarControle();
            }
        };
        
        document.getElementById('exportarRelatorioBtn').onclick = () => this.exportarRelatorio();
    }

    async atualizarGuiche() {
        const guicheRef = this.database.ref(`guiches/${this.guicheId}`);
        await guicheRef.update({
            numero: this.configuracoes.guiche,
            atendente: this.configuracoes.atendente,
            ultimoAcesso: firebase.database.ServerValue.TIMESTAMP
        });
    }

    configurarModalCategorias() {
        const modal = document.getElementById('modalCategorias');
        const btnAbrir = document.getElementById('gerenciarCategoriasBtn');
        const btnFechar = document.querySelector('.modal-close');
        
        console.log('Configurando modal...', btnAbrir);
        
        if (btnAbrir) {
            btnAbrir.onclick = (e) => {
                e.preventDefault();
                console.log('Abrindo modal de categorias');
                this.renderizarModalCategorias();
                modal.style.display = 'block';
            };
        }
        
        if (btnFechar) {
            btnFechar.onclick = () => {
                modal.style.display = 'none';
            };
        }
        
        window.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        };
        
        const btnAdicionar = document.getElementById('adicionarCategoriaBtn');
        if (btnAdicionar) {
            btnAdicionar.onclick = () => {
                const nome = document.getElementById('novaCategoriaNome').value;
                const cor = document.getElementById('novaCategoriaCor').value;
                const icone = document.getElementById('novaCategoriaIcone').value;
                
                if (nome.trim()) {
                    console.log('Adicionando categoria:', nome);
                    this.adicionarCategoria(nome, cor, icone);
                    document.getElementById('novaCategoriaNome').value = '';
                    this.renderizarModalCategorias();
                }
            };
        }
    }

    renderizarModalCategorias() {
        const container = document.getElementById('categoriasListModal');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.categorias.forEach(categoria => {
            const item = document.createElement('div');
            item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee;';
            
            item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 20px; height: 20px; border-radius: 5px; background-color: ${categoria.cor};"></div>
                    <span>${categoria.icone} <strong>${categoria.nome}</strong> (${categoria.contador || 0} senhas)</span>
                </div>
                ${this.categorias.length > 1 ? `
                    <button class="btn-danger btn-small" onclick="sistema.removerCategoria('${categoria.id}')">
                        Remover
                    </button>
                ` : ''}
            `;
            
            container.appendChild(item);
        });
    }

    async resetarSistema() {
        if (confirm('ATENÇÃO: Isso apagará TODOS os dados do sistema. Continuar?')) {
            await Promise.all([
                this.database.ref('categorias').set(this.getCategoriasPadrao()),
                this.database.ref('fila').set([]),
                this.database.ref('senhaAtual').set(null),
                this.database.ref('historico').set([]),
                this.database.ref('estatisticas').set(this.getEstatisticasPadrao())
            ]);
        }
    }

    exportarRelatorio() {
        const relatorio = {
            data: new Date().toISOString(),
            estatisticas: this.estatisticas,
            categorias: this.categorias,
            historico: this.historico,
            fila: this.fila
        };
        
        const blob = new Blob([JSON.stringify(relatorio, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    renderizarInterface() {
        if (this.isTotemPage) {
            this.renderizarTotem();
        } else if (this.isDisplayPage) {
            this.renderizarDisplay();
        } else if (this.isControlePage) {
            this.renderizarControle();
        }
    }
}

// Inicializar sistema
let sistema;
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado, iniciando sistema...');
    sistema = new SistemaSenhasFirebase();
    window.sistema = sistema;
});