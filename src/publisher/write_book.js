
const { setBookProgress } = require("./write_book_progress");

const { generateResponse, rateBookText } = require("./author_speak");

const prompts = require("./prompts");

async function buildResponseList(step, authors, prompt) {
    let responses = [];
    for (let i = 0; i < authors.length; i++) {
        const author = authors[i];
        setBookProgress(step + i + 1, `Generating response for ${author.name}`);
        const response = await generateResponse(author.id, prompt);
        responses.push(response);
    }
    return responses;
}


async function writeBook(bookDescription) {
    let step = 0;

    const authors = require("../authors/authors.json");

    setBookProgress(++step, "Validating input");
    if (!bookDescription || typeof bookDescription !== "string") {
        throw new Error("prompt must be a non-empty string");
    }
    let prompt = "";
    try {
        prompt = prompts.prompt1Plotline(bookDescription);
        let plotlines = await buildResponseList(step, authors, prompt);
        step += authors.length;

        let scores = [];
        for(let i = 0; i < authors.length; i++) {
            let score = 0;
            for(let j = 0; j < authors.length; j++) {
                setBookProgress(++step, `Ranking Plotline: ${authors[i].name} > ${authors[j].name}`);
                if(i == j) continue;
                prompt = prompts.prompt2RatePlotline(bookDescription, plotlines[j]);
                const response = await rateBookText(authors[i].id, prompt);
                score += parseInt(response) || 0;
            }
            scores.push(score);
        }
        console.log(scores);

        

        

    } catch (error) {
        throw new Error(`Failed to generate book: ${error.message}`);
    }

    

    return {
        ok: true,
        message: "Book pipeline finished",
    };
}

module.exports = {
    writeBook,
};

