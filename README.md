# 🏃‍♂️ Aura Run - Seu Treinador de Corrida com IA

![Aura Run Banner](https://aura-run.vercel.app/logo.png)

> **Aura Run** é uma plataforma premium de fitness que combina o poder da Inteligência Artificial com os seus dados do Strava para proporcionar uma experiência de treino única, personalizada e baseada em dados reais.

[![Vercel Deployment](https://img.shields.io/badge/Deploy-Vercel-black?style=for-the-badge&logo=vercel)](https://aura-run.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![Strava API](https://img.shields.io/badge/Strava-API-FC4C02?style=for-the-badge&logo=strava)](https://developers.strava.com)
[![Google Gemini](https://img.shields.io/badge/Gemini-AI-4285F4?style=for-the-badge&logo=google-gemini)](https://deepmind.google/technologies/gemini/)

---

## ✨ Funcionalidades Principais

### 🤖 Aura AI Coach
Seu treinador pessoal disponível 24/7. A Aura analisa seu histórico completo no Strava para:
- Gerar sugestões de treino diárias personalizadas.
- Explicar o porquê de cada treino baseado na sua carga atual.
- Responder dúvidas sobre nutrição, ritmo e prevenção de lesões.

### 📍 GPS Tracking em Tempo Real
Interface de treino ao vivo com:
- Mapa interativo (Leaflet) com rastro da corrida.
- Métricas em tempo real: Pace (ritmo), Distância, Tempo e Calorias.
- Notificações por voz/texto da Aura a cada quilômetro (Splits).
- Sistema de "pre-warming" de GPS para conexão instantânea.

### 📊 Análise de Desempenho (Stats)
Visualização rica dos seus dados:
- Gráficos semanais de volume de treino.
- Comparativos de ritmo médio e distância total.
- Detalhes profundos de cada atividade (Elevação, FC, Splits).

### 🗓️ Calendário de Corridas
Gerencie seus objetivos:
- Adicione suas próximas competições.
- Contagem regressiva automática para o dia da prova.
- Planejamento estratégico baseado na data do evento.

---

## 🛠️ Tech Stack

- **Framework:** [Next.js 15](https://nextjs.org/) (App Router)
- **Linguagem:** [TypeScript](https://www.typescriptlang.org/)
- **Estilização:** Vanilla CSS com [CSS Modules](https://github.com/css-modules/css-modules)
- **Mapas:** [Leaflet.js](https://leafletjs.com/)
- **IA:** [Groq API](https://groq.com/) (Llama 3) & [Google Gemini 2.0 Flash](https://ai.google.dev/)
- **Integração:** [Strava OAuth 2.0](https://developers.strava.com/docs/authentication/)

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
- Node.js 18+ instalado.
- Uma conta no [Strava Developers](https://developers.strava.com/) para obter as credenciais de API.
- Chaves de API do [Groq](https://console.groq.com/) ou [Google AI Studio](https://aistudio.google.com/).

### Instalação

1. Clone o repositório:
```bash
git clone https://github.com/XandyGomes/aura-run.git
cd aura-run
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
Crie um arquivo `.env.local` na raiz do projeto com:
```env
# Strava API
STRAVA_CLIENT_ID=seu_client_id
STRAVA_CLIENT_SECRET=seu_client_secret

# AI APIs
GROQ_API_KEY=sua_chave_groq
GEMINI_API_KEY=sua_chave_gemini
```

4. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

---

## 📱 Visual do Aplicativo

O Aura Run foi desenhado com uma estética **Premium Dark Mode**, focada em legibilidade e fluidez:
- **Glassmorphism:** Interfaces translúcidas e modernas.
- **Micro-interações:** Animações suaves em todas as transições de página.
- **Design Responsivo:** Otimizado para uso mobile durante a corrida.

---

## 👨‍💻 Desenvolvido por
**Xandy Gomes** - *Inovação e Performance*

---

## 📝 Licença
Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.
