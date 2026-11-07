# Estrutura de Armazenamento de Materiais Didáticos Locais

Este diretório organiza os recursos pedagógicos oficiais para os 20 componentes curriculares do Pré-Curso de Inteligência Artificial (200 horas - 10h cada).

## Organização por Módulos e Componentes

- `modulo-1/` (60h - 10h por disciplina)
  - `01-fundamentos/`: Fundamentos de Informática, SO e Ferramentas (10h)
  - `02-logica/`: Lógica de Programação e Algoritmos (10h)
  - `03-python/`: Programação em Python (10h)
  - `04-banco-dados/`: Banco de Dados e Big Data (10h)
  - `05-matematica-estatistica/`: Matemática e Estatística Aplicada à IA (10h)
  - `06-fundamentos-ia/`: Fundamentos de IA e Aprendizado de Máquina (10h)

- `modulo-2/` (60h - 10h por disciplina)
  - `07-python-ciencia-dados/`: Python para Ciência de Dados (10h)
  - `08-ml-aplicado/`: Machine Learning Aplicado (10h)
  - `09-deep-learning/`: Redes Neurais Artificiais e Deep Learning (10h)
  - `10-pln-chatbots/`: PLN e Chatbots (10h)
  - `11-metodologia/`: Metodologia para Elaboração de Produções Técnicas (10h)
  - `12-pratica-supervisionada-1/`: Prática Profissional Supervisionada I (10h)

- `modulo-3/` (80h - 10h por disciplina)
  - `13-seguranca-lgpd/`: Segurança, Governança e LGPD (10h)
  - `14-engenharia-software-ia/`: Engenharia de Software para IA (10h)
  - `15-mlops-deploy/`: MLOPS e Deploy (10h)
  - `16-assistentes-ia/`: Planejamento de Assistentes em IA (10h)
  - `17-llms-ia/`: LLMs e Inteligência Artificial (10h)
  - `18-visao-computacional/`: Visão Computacional Aplicada (10h)
  - `19-gestao-projetos-ia/`: Gestão de Projetos em IA (10h)
  - `20-pratica-supervisionada-2/`: Prática Profissional Supervisionada II (10h)

## Padrão Oficial de Nomenclatura dos Recursos por Disciplina (01 a 20)
Para evitar conflito de nomes ao baixar arquivos ou hospedá-los na nuvem, cada pasta de disciplina utiliza a numeração oficial da disciplina (01 a 20):
1. `video-aula-XX.mp4` (ex: `video-aula-01.mp4`, `video-aula-02.mp4` ... `video-aula-20.mp4`): Vídeo expositivo da aula
2. `slides-aula-XX.pdf` (ex: `slides-aula-01.pdf`, `slides-aula-02.pdf` ... `slides-aula-20.pdf`): Apresentação visual em PDF
3. `apostila-aula-XX.pdf` (ex: `apostila-aula-01.pdf`, `apostila-aula-02.pdf` ... `apostila-aula-20.pdf`): Material didático em PDF
4. `apostila-aula-XX.txt` (ex: `apostila-aula-01.txt`, `apostila-aula-02.txt` ... `apostila-aula-20.txt`): Versão textual da apostila
5. `material-estudo.txt`: Texto oficial consolidado para estudo e indexação semântica no Tutor IA (RAG)
6. `apostila-[nome-da-disciplina].pdf`: Livro técnico integral da disciplina (ex: `apostila-logica-algoritmos.pdf`)

## Estratégia de Persistência no Render.com
Em instâncias web no Render (Cloud Run ou Render Web Service), o sistema de arquivos local é efêmero por padrão (reinicializações descartam arquivos gerados dinamicamente).
- **Desenvolvimento**: Arquivos servidos diretamente de `public/cursos/`.
- **Produção no Render**:
  - Opção A (Recomendada para PDFs e vídeos leves): **Render Persistent Disk** montado em `/var/data/cursos` com link simbólico.
  - Opção B (Recomendada para vídeos em alta resolução): **Object Storage compatível com S3 / Google Cloud Storage / Cloudflare R2** com URLs assinadas ou CDN reversa.
