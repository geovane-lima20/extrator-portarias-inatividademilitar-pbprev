// identifica qual worker eu devo usar para processar o PDF em paralelo à página aberta.
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

let pdfFile = null;
let textoCompleto = ""; 
let paginaInicialSelecionada = null;
let paginaFinalSelecionada = null;

const dropzone = document.getElementById("dropzone");
const capturaNumeroEData = document.getElementById("capturaNumeroEData");
const processar = document.getElementById("processar");

// Permite arrastar o PDF e também clicar na área para selecionar o arquivo.
const inputArquivo = document.createElement("input");
inputArquivo.type = "file";
inputArquivo.accept = "application/pdf"; // determina que o input aceitará apenas arquivos em PDF, mas precisa garantir isso na function carregarArquivo
inputArquivo.style.display = "none";
document.body.appendChild(inputArquivo);

const camposAssinatura = [ //cria um array para cada id de assinatura que se encontra no index
  "responsavelAssinatura",
  "cargoAssinatura", 
  "numeroDiario", 
  "dataDiario"
];

camposAssinatura.forEach((id) => { //prepara os inputs para executar a função atualizarPreviewAssinatura
  const campo = document.getElementById(id);

  if (campo) {
    campo.addEventListener("input", atualizarPreviewAssinatura);
  } else {
    console.warn(`Campo de assinatura não encontrado no HTML: ${id}`);
  }
});

atualizarPreviewAssinatura(); //executa a função sem receber os inputs, para pedir que os dados sejam preenchidos

function carregarArquivo(arquivo) { //função para carregar o arquivo dentro do dropzone
  if (!arquivo || arquivo.type !== "application/pdf") {
    alert("Envie um arquivo PDF válido.");
  
    dropzone.classList.remove("sobreposto");

    if (pdfFile) {
        dropzone.classList.add("dropado");
        dropzone.textContent = "PDF carregado: " + pdfFile.name;
      } else { 
        dropzone.classList.remove("dropado");
        dropzone.textContent = "Arraste o Diário Oficial (PDF) aqui";
      }

    return;
  }

  pdfFile = arquivo;

  dropzone.classList.remove("sobreposto");
  dropzone.classList.add("dropado");
  dropzone.textContent = "PDF carregado: " + pdfFile.name;
}

// Para o evento de mudança no inputArquivo, no caso a inserção do PDF, ele condiciona se tem arquivo e ele está listado, executando a função de carregar.
inputArquivo.addEventListener("change", (e) => {
  if (e.target.files && e.target.files[0]) {
    carregarArquivo(e.target.files[0]);
  }
});

dropzone.addEventListener("click", () => inputArquivo.click());//se clicar na dropzone executa o click no inputArquivo

dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  
  if (pdfFile) {
    dropzone.classList.remove("dropado"); 
  }

  dropzone.classList.add("sobreposto");
  dropzone.textContent = "Solte o arquivo aqui";
});

dropzone.addEventListener("dragleave", () => {
  
  if (pdfFile) {
    dropzone.classList.remove("sobreposto");
    dropzone.classList.add("dropado");
    dropzone.textContent = "PDF carregado: " + pdfFile.name;
  } else {
    dropzone.classList.remove("sobreposto");
    dropzone.textContent = "Arraste o Diário Oficial (PDF) aqui";
  }
});

dropzone.addEventListener("drop", (e) => {
  e.preventDefault(); 

  dropzone.classList.remove("sobreposto");

  const arquivoCarregado = e.dataTransfer.files && e.dataTransfer.files[0]; 

  if (!arquivoCarregado) { 
    if (pdfFile) {
      dropzone.classList.add("dropado");
      dropzone.textContent = "PDF carregado: " + pdfFile.name;
    } else {
      dropzone.classList.remove("dropado");
      dropzone.textContent = "Arraste o Diário Oficial (PDF) aqui";
    }

    return;
  }

  carregarArquivo(arquivoCarregado);
});

capturaNumeroEData.onclick = async () => { //evento de click para capturar a data do diário
  try {
    if (!pdfFile) {
      alert("Envie um PDF primeiro.");
      return;
    }

    capturaNumeroEData.disabled = true; 
    capturaNumeroEData.classList.add("is-loading"); 
    capturaNumeroEData.textContent = "Capturando..."; 

    const dados = await capturarNumeroEDataDoCabecalho(pdfFile); //função para capturar número e data do diário

    if (!dados.numeroDiario || !dados.dataDiario) { 
      console.warn("Texto lido no cabeçalho:", dados.textoCabecalho);
      alert("Não foi possível identificar automaticamente o número e/ou a data do Diário.");
      document.getElementById("numeroDiario").value = ""; 
      document.getElementById("dataDiario").value = "";
      return;
    }

    document.getElementById("numeroDiario").value = dados.numeroDiario; 
    document.getElementById("dataDiario").value = dados.dataDiario;

    atualizarPreviewAssinatura();

  } catch (erro) {
    console.error(erro);
    alert("Erro ao capturar número e data do Diário. Veja o console para detalhes.");
  } finally {
    capturaNumeroEData.disabled = false; 
    capturaNumeroEData.classList.remove("is-loading"); 
    capturaNumeroEData.textContent = "Capturar número e data do diário";
  }
};

processar.onclick = async () => { 
  try {
    if (!pdfFile) { 
      alert("Envie um PDF primeiro.");
      return;
    }

    const paginaInicial = parseInt(document.getElementById("paginaInicial").value, 10);
    let paginaFinal = parseInt(document.getElementById("paginaFinal").value, 10);
    const assinatura = montarAssinatura(); //função para montar a assinatura inserida

    if (!paginaInicial) {
      alert("Insira o número da página inicial.");
      return;
    }

    
    if (!paginaFinal) {
      paginaFinal = paginaInicial;
    }

    if (paginaFinal < paginaInicial) {
      alert("A página final não pode ser menor que a página inicial.");
      return;
    }

    if (!assinatura) {
      alert("Preencha todos os campos de assinatura que deve constar abaixo de cada portaria.");
      return;
    }

    //pega as variáveis dentro do bloco do click e coloca em variáveis globais
    paginaInicialSelecionada = paginaInicial;
    paginaFinalSelecionada = paginaFinal;
    textoCompleto = "";

    processar.disabled = true;
    processar.classList.add("is-loading");
    processar.textContent = "Processando...";

    const url = URL.createObjectURL(pdfFile); //pega o pdfFile e cria-se uma URL temporária dentro do navegador, para que o PDF.js leia o PDF

    try {
      const pdf = await pdfjsLib.getDocument(url).promise;
      const primeiraPaginaParaLer = Math.max(1, paginaInicial - 1); 
      const ultimaPaginaParaLer = Math.min(pdf.numPages, paginaFinal + 1); 

      for (let i = primeiraPaginaParaLer; i <= ultimaPaginaParaLer; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1 }); // função getViewport em scale 1 pega as coordenadas de leitura dentro da página.
        const content = await page.getTextContent();
        
        //função criada para organizar o texto da página em uma única string
        const paginaReconstruida = reconstruirTextoPagina(content, viewport.width, viewport.height);

        textoCompleto += `\n\n===== PÁGINA ${i} =====\n\n${paginaReconstruida.textoPagina}`;
      } 

      textoCompleto = limparTextoExtraido(textoCompleto);//função para limpar o texto, retirando hífens, espaços e caracteres invisíveis

      //portarias será um array que recebe todas as portarias de reserva e reforma, devidamente formatadas
      const portarias = extrairPortariasAlvo(assinatura); 

      //se não for encontrada nenhuma portaria, joga um alerta para que o usuário verifique o intervalo de páginas selecionadas
      if (portarias.length === 0) {
        alert("Nenhuma portaria de reserva remunerada ou reforma foi encontrada nesse intervalo. Confira as páginas informadas.");
        return;
      }

      await gerarWord(portarias, montarNomeArquivo());

      alert(`Extração concluída. Portarias encontradas: ${portarias.length}`);
    } finally {
      URL.revokeObjectURL(url); //limpa o url do pdf lido, para não guardar no navegador
    }

  } catch (erro) { 
    console.error(erro); 
    alert("Erro ao processar o PDF. Veja o console do navegador para detalhes."); 
  } finally {
    processar.disabled = false; 
    processar.classList.remove("is-loading"); 
    processar.textContent = "Extrair Portarias";
  }
};

async function capturarNumeroEDataDoCabecalho(arquivoPdf) { //função para capturar o número e data do diário
  const url = URL.createObjectURL(arquivoPdf);

  try {
    const pdf = await pdfjsLib.getDocument(url).promise; 

    const primeiraPagina = await pdf.getPage(1); 
    const viewport = primeiraPagina.getViewport({ scale: 1 }); 
    const content = await primeiraPagina.getTextContent();

    const textoCabecalho = extrairTextoCabecalho(content, viewport.width, viewport.height); 

    const numeroDiario = extrairNumeroDiarioDoCabecalho(textoCabecalho); 
    const dataCapturada = extrairDataDiarioDoCabecalho(textoCabecalho); 

    return { 
      numeroDiario, 
      dataDiario: dataCapturada.dataISO, 
      dataFormatada: dataCapturada.dataFormatada, 
      textoCabecalho, 
    };
  } finally {
    URL.revokeObjectURL(url); 
  }
}

function extrairTextoCabecalho(content, pageWidth, pageHeight) { //função para extrair o texto do cabeçalho
  const limiteInferiorCabecalho = pageHeight * 0.72; //define a coordenada até one o cabeçalho vai na página do PDF

  const itensCabecalho = content.items 
    .filter((item) => item.str && item.str.trim() !== "") 
    .map((item) => { 
      return { 
        str: item.str.trim(), 
        x: item.transform[4], 
        y: item.transform[5], 
        width: item.width || 0, 
        height: item.height || 0, 
      };
    })
    .filter((item) => {
      return item.y >= limiteInferiorCabecalho; 
    })
    .sort((a, b) => {
      if (Math.abs(b.y - a.y) > 2) {
        return b.y - a.y;
      }

      return a.x - b.x;
    });

  return montarTextoPorLinhasSimples(itensCabecalho); //retorna os itens do cabeçalho nesta função de montar o texto em uma linha
}

function montarTextoPorLinhasSimples(itens) { // função para receber os itens da função extrairTextoCabecalho e montar a linha
  let linhas = [];
  const toleranceY = 2; // tolerância para definir o que está em linhas diferentes

  for (const item of itens) { 
    const ultimaLinha = linhas[linhas.length - 1]; 

    if (!ultimaLinha || Math.abs(ultimaLinha.y - item.y) > toleranceY) { 
      linhas.push({ 
        y: item.y,
        itens: [item],
      });
    } else { 
      ultimaLinha.itens.push(item);
      ultimaLinha.y = (ultimaLinha.y + item.y) / 2;
    }
  }

  return linhas 
    .map((linha) => { 
      return linha.itens 
        .sort((a, b) => a.x - b.x) 
        .map((item) => item.str)
        .join(" ");
    })
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
}

function extrairNumeroDiarioDoCabecalho(textoCabecalho) { //extrair o número do diário
  const texto = String(textoCabecalho || "");

  const match = texto.match(/\bN[º°O]?\s*\.?\s*(\d{1,3}(?:\.\d{3})+|\d{4,6})\b/i);

  if (!match) {
    return "";
  }

  return match[1].trim();
}

function extrairDataDiarioDoCabecalho(textoCabecalho) { //função para extrair a data no formato yyyy-mm-dd
  const meses = {
    janeiro: "01",
    fevereiro: "02",
    marco: "03",
    março: "03",
    abril: "04",
    maio: "05",
    junho: "06",
    julho: "07",
    agosto: "08",
    setembro: "09",
    outubro: "10",
    novembro: "11",
    dezembro: "12",
  };

  const texto = String(textoCabecalho || "");

  const regexData =
    /João\s+Pessoa\s*-\s*(?:segunda-feira|terça-feira|terca-feira|quarta-feira|quinta-feira|sexta-feira|sábado|sabado|domingo)\s*,\s*(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})/i;

  const match = texto.match(regexData);

  if (!match) {
    return {
      dataISO: "",
      dataFormatada: "",
    };
  }

  const dia = match[1].padStart(2, "0");
  const mesNomeNormalizado = normalizarBusca(match[2]).toLowerCase();
  const ano = match[3];

  const mes = meses[mesNomeNormalizado];

  if (!mes) {
    return {
      dataISO: "",
      dataFormatada: "",
    };
  }

  return {
    dataISO: `${ano}-${mes}-${dia}`,
    dataFormatada: `${dia} de ${mesNomeNormalizado} de ${ano}`,
  };
}

/*Função para reconstruir o texto da página que está espalhado dentro do PDF. Ele pega o conteúdo e lê a largura e altura.
 Isso vai servir para definir o meio da página, como também remover textos de cabeçalhos e rodapés.*/ 
function reconstruirTextoPagina(content, pageWidth, pageHeight) {
  const toleranceY = 2; // coloca uma tolerância de 2 para o eixo Y (altura). Caso passe disso, considera-se que o conteúdo está em outra linha.
  const margemSuperior = 25;
  const margemInferior = 2;

  const itens = content.items
    .filter((item) => item.str && item.str.trim() !== "") // método filtra apenas os itens que são dif. de "", já com a limpeza do trim.
    .map((item) => {
      const x = item.transform[4]; // coordenada de largura
      const y = item.transform[5]; // coordenada de altura

      return { 
        str: item.str,
        x, 
        y, 
        width: item.width || 0, 
        height: item.height || 0,
      };
    })
    .filter((item) => {
      if (!pageHeight) return true; // se a página não tem altura, retorna true e não aplica o filtro, passa direto.

      return item.y > margemInferior && item.y < pageHeight - margemSuperior;
    });

  // método para separar as colunas do DOE
  const limiteColuna = pageWidth / 2;
  const margemDivisoria = 3; // define que a distância entre a linha de colunas para a esquerda e para a direita será 3

  const colunaEsquerda = itens.filter((item) => item.x < limiteColuna - margemDivisoria);
  const colunaDireita = itens.filter((item) => item.x >= limiteColuna + margemDivisoria);

  const textoEsquerda = montarColuna(colunaEsquerda, toleranceY);
  const textoDireita = montarColuna(colunaDireita, toleranceY);

  return {
    textoPagina: [textoEsquerda, textoDireita].filter(Boolean).join("\n\n"),
    colunaEsquerda: textoEsquerda,
    colunaDireita: textoDireita,
  }

}

function montarColuna(itens, toleranceY) {// função para organizar o texto conforme as colunas do diário
  if (!itens.length) return "";

  itens.sort((a, b) => { // função para ordenar itens do texto
    if (Math.abs(b.y - a.y) > toleranceY) return b.y - a.y; // se (b.y-a.y) for positivo, b vem antes de a, pois a maior coordenada y significa texto acima
    return a.x - b.x; // estando no mesmo y, se (a.x - b.x) for negativo, a vem antes de b.
  });

  const linhas = [];

  for (const item of itens) {
    const ultimaLinha = linhas[linhas.length - 1];

    if (!ultimaLinha || Math.abs(ultimaLinha.y - item.y) > toleranceY) { 
      linhas.push({ y: item.y, itens: [item] }); 
    } else {
      ultimaLinha.itens.push(item); 
      ultimaLinha.y = (ultimaLinha.y + item.y) / 2;
    }
  }

  const linhasTexto = linhas
    .map((linha) => {
      linha.itens.sort((a, b) => a.x - b.x);//garantir que as palavras estão na ordem correta

      let textoLinha = "";
      let anterior = null;

      for (const item of linha.itens) { 
        if (!anterior) {
          textoLinha += item.str; 
        } else {
          const fimAnterior = anterior.x + anterior.width; // marcar o comprimento do texto.
          const gap = item.x - fimAnterior; // marca o espaço entre o item analisado e a frase já montada
          const alturaReferencia = Math.max(anterior.height || 8, item.height || 8); //marca a altura para se ter uma ideia do tamanho da fonte utilizada
          const limiteEspaco = Math.max(1.1, alturaReferencia * 0.18); //definir se tem espaço

          // se tem espaço, coloca entre uma string e outra
          textoLinha += gap > limiteEspaco ? " " + item.str : item.str;
        }

        anterior = item;
      }

      return { 
        y: linha.y,
        texto: textoLinha.trim(),
      };
    })
    //depois de mapear, aplica-se o filtro para manter apenas o que não cair no filtro de ruído e o que não é linha vazia.
    .filter((linha) => linha.texto && !ehLinhaRuido(linha.texto));

  let resultado = "";

  for (let i = 0; i < linhasTexto.length; i++) {
    const atual = linhasTexto[i];
    const proxima = linhasTexto[i + 1];

    resultado += atual.texto;

    if (proxima) {
      const distanciaVertical = Math.abs(atual.y - proxima.y);
      resultado += distanciaVertical > 18 ? "\n\n" : "\n";
    }
  }

  return resultado.trim();
}

function ehLinhaRuido(linha) { // função que identifica ruídos de linhas, como nº de páginas, texto de cabeçalhos e rodapés.
  const t = normalizarBusca(linha);

  if (!t) return true;

  if (/^\d+$/.test(t)) return true; // se identificar apenas números, é ruído.
  if (t.includes("DIARIO OFICIAL") && t.includes("JOAO PESSOA")) return true; // se identificar o texto do cabeçalho, é ruído.
  if (/^\d+\s+JOAO PESSOA\s*-/.test(t)) return true; // Cabeçalho parcial, exemplo: "38 JOAO PESSOA - SEXTA-FEIRA, 01 DE MAIO DE 2026"
  if (/^JOAO PESSOA\s*-/.test(t) && /\d{4}/.test(t)) return true;  // Cabeçalho parcial sem número antes
  if (/^DIARIO OFICIAL\s*\d*$/.test(t)) return true;   // Fragmento isolado do cabeçalho
  if (t.includes("PUBLICACOES:") && t.includes("DOEPB")) return true; // se identificar a menção do site, é ruído.

  return false;
}

function limparTextoExtraido(texto) { //função para limpar o texto de símbolos 
  return texto
    .replace(/[\u00ad\ufffe\uffff]/g, "") //troca caracteres invisíveis por ""
    .replace(/\r/g, "\n") //padroniza a quebra de linha por \n
    .replace(/([a-zà-ÿ])-\s*\n\s*([a-zà-ÿ])/gi, "$1$2") //remove hífem de palavras quebradas e as une
    .replace(/-\s*\n\s*/g, "-") //preserva o hífen quando faz parte da escrita
    .replace(/[ \t]+/g, " ") //substitui vários espaços ou tabulação por um único espaço
    .replace(/[ \t]+\n/g, "\n") //remove espaço ou tabulações antes de quebra de linha
    .replace(/\n[ \t]+/g, "\n") //remove espaço ou tabulações depois de quebra de linha
    .replace(/\n{3,}/g, "\n\n") //reduz três ou mais quebras de linha para apenas duas
    .trim(); //remove espaços antes e depois do texto
}

function extrairPortariasAlvo(assinatura) { //função que pega o texto completo e extrai as portarias de reserva e reforma da PBPrev
  const regexInicio = /GABINETE\s+DA\s+PRESID[ÊE]NCIA\s+PORTARIA\s*[–—-]\s*[AP]\s*[–—-]\s*N[º°O]?\.?\s*\d+/gi;
  const inicios = []; 
  let match; 

  while ((match = regexInicio.exec(textoCompleto)) !== null) { // o match vai vai rodar a função .exec no textoCompleto e receber todas as ocorrências da regex
    inicios.push({ index: match.index, texto: match[0] });
  }

  const melhoresPortarias = new Map();

  for (let i = 0; i < inicios.length; i++) {
    const inicio = inicios[i].index; 
    const fim = i + 1 < inicios.length ? inicios[i + 1].index : textoCompleto.length; 
    const trecho = textoCompleto.substring(inicio, fim).trim();

    if (!trechoTocaFaixaSelecionada(trecho, inicio)) continue; 
    if (!ehPortariaDeReservaOuReforma(trecho)) continue;

    const paginaInicial = descobrirPaginaDoIndice(inicio);

    const portariaFormatada = formatarPortaria(trecho, assinatura, paginaInicial); 

    if (!portariaFormatada) continue;

    const chave = normalizarBusca(portariaFormatada.titulo);

    const pontuacao = calcularPontuacaoPortaria(portariaFormatada);
    const existente = melhoresPortarias.get(chave);

    if (!existente || pontuacao > existente.pontuacao) {
      melhoresPortarias.set(chave, {
        portaria: portariaFormatada,
        pontuacao,
        ordem: i,
      });
    }
  }

  return [...melhoresPortarias.values()]
    .sort(
      (a, b) =>
        a.portaria.paginaInicial - b.portaria.paginaInicial ||
        a.ordem - b.ordem
    )
    .map((item) => item.portaria);
}

function calcularPontuacaoPortaria(portaria) {
  const texto = portaria.blocos.join(" ");
  const textoBusca = normalizarBusca(texto);

  let pontuacao = texto.length;

  if (textoBusca.includes("JOAO PESSOA")) {
    pontuacao += 10000;
  }

  if (
    /JOAO PESSOA\s*,?\s*\d{1,2}\s+DE\s+[A-Z]+\s+DE\s+\d{4}/.test(textoBusca)
  ) {
    pontuacao += 10000;
  }

  if (textoBusca.includes("RESOLVE")) {
    pontuacao += 1000;
  }

  if (
    textoBusca.includes("RESERVA REMUNERADA") ||
    textoBusca.includes("REFORMAR") ||
    textoBusca.includes("REFORMA")
  ) {
    pontuacao += 1000;
  }

  const qtdResolve = (textoBusca.match(/\bRESOLVE\b/g) || []).length;
  if (qtdResolve > 1) {
    pontuacao -= 50000;
  }

  if (textoBusca.includes("RESENHA/PBPREV")) {
    pontuacao -= 50000;
  }

  if (/\b\d{2}\s+\d{4}-\d{2}\b/.test(textoBusca)) {
    pontuacao -= 50000;
  }

  if (textoBusca.includes("DIARIO OFICIAL")) {
    pontuacao -= 10000;
  }

  return pontuacao;
}

function trechoTocaFaixaSelecionada(trecho, indiceInicio) { // função para descobrir se a portaria toca a faixa de páginas a ser analisada.
  const paginaInicio = descobrirPaginaDoIndice(indiceInicio); // função para descobrir a página onde o trecho da portaria começa

  if (paginaInicio >= paginaInicialSelecionada && paginaInicio <= paginaFinalSelecionada) {
    return true;
  }

  const paginasNoTrecho = [...trecho.matchAll(/===== PÁGINA (\d+) =====/g)].map((m) => Number(m[1])); 

  return paginasNoTrecho.some( // retorna true caso uma das páginas em que a portaria está contida esteja dentro da página inicial e final
    (pagina) => pagina >= paginaInicialSelecionada && pagina <= paginaFinalSelecionada
  );
}

function descobrirPaginaDoIndice(indice) { // função para descobrir em que página se inicia a portaria, recebendo o índice (início) da portaria a ser analisada
  const textoAteIndice = textoCompleto.substring(0, indice); 

  const matches = [...textoAteIndice.matchAll(/===== PÁGINA (\d+) =====/g)]; 
  if (!matches.length) return paginaInicialSelecionada;

  return Number(matches[matches.length - 1][1]);
}

function ehPortariaDeReservaOuReforma(trecho) { //função que vai retornar se o trecho separado da portaria é de reserva ou reforma
  const texto = normalizarBusca(trecho);

  const ehPBPrev = texto.includes("PBPREV") || texto.includes("PARAIBA PREVIDENCIA"); 
  const ehPortariaA = /PORTARIA\s*[–—-]?\s*A\s*[–—-]?\s*N/.test(texto); 

  const trataDeReserva = texto.includes("RESERVA REMUNERADA"); 
  const trataDeReforma = /\bREFORMA\b/.test(texto) || /\bREFORMAR\b/.test(texto); 

  const aposentadoriaComum = texto.includes("CONCEDER APOSENTADORIA") && !trataDeReserva && !trataDeReforma; 
  const pensao = texto.includes("PENSAO") && !trataDeReserva && !trataDeReforma; 

  return ehPBPrev && ehPortariaA && (trataDeReserva || trataDeReforma) && !aposentadoriaComum && !pensao;
}

function formatarPortaria(trecho, assinatura, paginaInicial) { //função que deixa a portaria no formato que queremos para jogar na nota de boletim
  const textoSemMarcadores = trecho
    .replace(/===== PÁGINA \d+ =====/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();

  const tituloMatch = textoSemMarcadores.match(/PORTARIA\s*[–—-]\s*([AP])\s*[–—-]\s*N[º°O]?\.?\s*([\d.]+)/i); 

  if (!tituloMatch) return null;

  const tipo = tituloMatch[1].toUpperCase();
  const numero = tituloMatch[2].replace(/\D/g, "").padStart(4, "0");
  const titulo = `PORTARIA – ${tipo} – Nº. ${numero}`;

  const depoisDoTitulo = textoSemMarcadores.slice(tituloMatch.index + tituloMatch[0].length);
  const resolveMatch = depoisDoTitulo.match(/\bRESOLVE\b/i);

  if (!resolveMatch) return null;

  const preambuloBruto = depoisDoTitulo.slice(0, resolveMatch.index);
  const depoisDoResolve = depoisDoTitulo.slice(resolveMatch.index + resolveMatch[0].length);
  
  const dataRegex = /João\s+Pessoa(?:-PB)?\s*,?\s*\d{1,2}\s+de\s+[a-zç]+\s+de\s+\d{4}\.?/i; 
  const dataMatch = depoisDoResolve.match(dataRegex);

  let corpoBruto = depoisDoResolve;
  let data = "";

  if (dataMatch) { 
    corpoBruto = depoisDoResolve.slice(0, dataMatch.index); 
    data = normalizarBloco(dataMatch[0]); 
  }

  const preambulo = normalizarBloco(preambuloBruto);
  const corpo = normalizarBloco(corpoBruto);
  const linhasAssinatura = assinatura.split("\n").map((l) => l.trim()).filter(Boolean); 

  const blocos = [ 
    "GABINETE DA PRESIDÊNCIA",
    titulo,
    preambulo,
    "RESOLVE",
    corpo,
  ];

  if (data) blocos.push(data);

  blocos.push(...linhasAssinatura);
  blocos.push(`Página inicial no PDF: ${paginaInicial}`); 

  return {
    titulo,
    paginaInicial,
    blocos: blocos.filter(Boolean),
  };
}

//função para substituir os caracteres indesejáveis por "" ou " ". diferente de limparTextoExtraido pq esta não limpa as quebras de linha
function normalizarBloco(texto) { 
  return String(texto || "")
    .replace(/[\u00ad\ufffd\ufffe\uffff]/g, "")

    // Remove fragmentos de cabeçalho que escapem da montagem da página
    .replace(/\b\d{1,3}\s+João\s+Pessoa\s*-\s*[A-Za-zÀ-ÿ-]+,\s*\d{1,2}\s+de\s+[a-zç]+\s+de\s+\d{4}/gi, " ")
    .replace(/\bJoão\s+Pessoa\s*-\s*[A-Za-zÀ-ÿ-]+,\s*\d{1,2}\s+de\s+[a-zç]+\s+de\s+\d{4}/gi, " ")
    .replace(/\bDi[aá]rio\s+O[fﬁ]i?\s*cial\b/gi, " ")

    .replace(/\s*\n\s*/g, " ")
    .replace(/PBPREV\s*,/gi, "PBPREV,")
    .replace(/nº\s*\./gi, "nº.")
    .replace(/(Art\.\s*\d+º)(?=\S)/gi, "$1 ")
    .replace(/([,;:])(?=[A-Za-zÀ-ÿ“”])/g, "$1 ")
    .replace(/([a-zà-ÿ])([“”"])/gi, "$1 $2")
    .replace(/\ba\s*Reserva\b/gi, "a Reserva")
    .replace(/\bpara\s+aReserva\b/gi, "para a Reserva")
    .replace(/\bda\s*Constituição\b/gi, "da Constituição")
    .replace(/\bdo\s*[“”"]\s*art/gi, "do “art")
    .replace(/([“"])\s+/g, "$1")
    .replace(/\s+([”"])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarBusca(texto) { // função para facilitar busca. Ele não altera o texto.
  return String(texto || "") 
    .normalize("NFD") // separa o acento do caractere
    .replace(/[\u0300-\u036f]/g, "") // remove as marcas de acento
    .replace(/[\u00ad\ufffe\uffff]/g, "") // retira caracteres especiais
    .replace(/\s+/g, " ") // troca espaços múltiplos por um espaço só
    .toUpperCase()
    .trim();
}

function montarAssinatura() { //função que monta a assinatura das portarias
  const responsavel = document.getElementById("responsavelAssinatura").value.toUpperCase().trim();
  const cargo = document.getElementById("cargoAssinatura").value.trim();
  const numeroDiario = document.getElementById("numeroDiario").value.trim();
  const dataDiario = document.getElementById("dataDiario").value;

  if (!responsavel || !cargo || !numeroDiario || !dataDiario) {
    return "";
  }

  const dataFormatada = formatarDataPorExtenso(dataDiario); // função para colocar a data por extenso

  return normalizarAssinatura( //função para colocar a assinatura no formato correto, constando a transcrição do diário oficial
    `${responsavel}
    ${cargo} (Transcrito do DOEPB nº ${numeroDiario}, de ${dataFormatada})`
  );
}

function normalizarAssinatura(assinatura) { //função para normalizar o formato da assinatura
  return String(assinatura || "") //garante que a assinatura é string, se não retorna ""
    .split("\n")
    .map((linha) => linha.trim()) 
    .filter(Boolean) 
    .join("\n"); 
}

function formatarDataPorExtenso(dataISO) { // função para formatar a data por extenso
  const [ano, mes, dia] = dataISO.split("-");

  const meses = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro"
  ];

  return `${dia} de ${meses[Number(mes) - 1]} de ${ano}`;
}

function atualizarPreviewAssinatura() { //função para mostrar como a assinatura vai ficar
  const preview = document.getElementById("previewAssinatura"); 

  if (!preview) {
    console.warn("Elemento de prévia não encontrado no HTML: previewAssinatura");
    return;
  }

  const assinatura = montarAssinatura(); 

  preview.textContent = assinatura || "Preencha os campos acima."; 
}

async function gerarWord(portarias, nomeArquivo) {//função para jogar as portarias em um .docx e baixar

  //uma forma limpa de criar 6 variáveis pegando a equivalência na biblioteca do window.docx já inserida no HTML
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    AlignmentType,
    PageBreak,
  } = window.docx;

  const children = [];

  portarias.forEach((portaria, index) => { 
    if (index > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] })); 
    }

    portaria.blocos.forEach((bloco, blocoIndex) => { 

      const blocoAnterior = portaria.blocos[blocoIndex - 1];

      if (blocoIndex > 0 && deveInserirLinhaEmBranco(blocoAnterior, bloco)) {
        children.push(new Paragraph({ text: "" })); 
      }

      children.push( 
        new Paragraph({ 
          alignment: AlignmentType.LEFT, 
          spacing: { before: 0, after: 0, line: 276 },
          children: [ 
            new TextRun({
              text: bloco, 
              font: "Arial", 
              size: 24, 
            }),
          ],
        })
      );
    });
  });

  const doc = new Document({ 
    sections: [ 
      {
        properties: { 
          page: { 
            margin: { 
              top: 1440, 
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children, 
      },
    ],
  });

  const blob = await Packer.toBlob(doc); 
  baixarBlob(blob, nomeArquivo); 
}

function deveInserirLinhaEmBranco(blocoAnterior, blocoAtual) { //para formatação da portaria, não inserir linha em branco ema alguns trechos
  const anterior = normalizarBusca(blocoAnterior);
  const atual = normalizarBusca(blocoAtual);

  if (
    anterior === "GABINETE DA PRESIDENCIA" &&
    atual.startsWith("PORTARIA")
  ) {
    return false;
  }

  if (atual.includes("TRANSCRITO DO DOEPB")) {
    return false;
  }

  return true;
}

function baixarBlob(blob, nomeArquivo) { //função para baixar o arquivo que está no blob
  const link = document.createElement("a"); 
  const url = URL.createObjectURL(blob); 

  link.href = url; 
  link.download = nomeArquivo; 
  document.body.appendChild(link); 
  link.click(); 
  link.remove(); 

  setTimeout(() => URL.revokeObjectURL(url), 1000);//após 1 segundo, libera a URL temporária criada para o blob.
}

function montarNomeArquivo() { //monta o nome do arquivo pela data do diário oficial
  const dataDiario = document.getElementById("dataDiario").value; 

  const numeroDiario = document
    .getElementById("numeroDiario") 
    .value
    .trim() 
    .replace(/[^\d.]/g, ""); 

  if (!dataDiario) {
    return "portarias_pbprev_reserva_reforma.docx"; 
  }

  const [ano, mes, dia] = dataDiario.split("-");
  const numero = numeroDiario || "sem_numero";

  const yyyy = ano; 
  const mm = mes.padStart(2, "0"); 
  const dd = dia.padStart(2, "0"); 

  return `portarias_pbprev_reserva_reforma_DOEPB_${numero}_${yyyy}-${mm}-${dd}.docx`;
}
