
const { setBookProgress } = require("./write_book_progress");

const { generateResponse, rateBookText } = require("./author_speak");

const prompts = require("./prompts");

async function buildResponseList(step, authors, prompt, label="Generating response") {
    let responses = [];
    for (let i = 0; i < authors.length; i++) {
        const author = authors[i];
        setBookProgress(step + i + 1, `${label} for ${author.name}`);
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
        let plotlines = await buildResponseList(step, authors, prompt, "Generating plotline");
        step += authors.length;

        // scores[j] is the total of the ratings author j received from every other author
        let scores = new Array(authors.length).fill(0);
        for(let i = 0; i < authors.length; i++) {
            for(let j = 0; j < authors.length; j++) {
                setBookProgress(++step, `Ranking Plotline: ${authors[i].name} > ${authors[j].name}`);
                if(i == j) continue;
                const ratingPrompt = prompts.prompt2RatePlotline(bookDescription, plotlines[j]);
                const response = await rateBookText(authors[i].id, plotlines[j], ratingPrompt);
                scores[j] += Number(response) || 0;
            }
        }
        const mainPlotlineIndex = scores.indexOf(Math.max(...scores));
        const mainPlotline = plotlines[mainPlotlineIndex];
        prompt = prompts.prompt3StoryBible(mainPlotline);

        let storyBibles = await buildResponseList(step, authors, prompt, "Generating story bible");
        step += authors.length;

        
        scores = new Array(authors.length).fill(0);
        for(let i = 0; i < authors.length; i++) {
            for(let j = 0; j < authors.length; j++) {
                setBookProgress(++step, `Ranking Story Bible: ${authors[i].name} > ${authors[j].name}`);
                if(i == j) continue;
                const ratingPrompt = prompts.prompt4RateStoryBible(bookDescription, mainPlotline, storyBibles[j]);
                const response = await rateBookText(authors[i].id, storyBibles[j], ratingPrompt);
                scores[j] += Number(response) || 0;
            }
        }
        const mainStoryBibleIndex = scores.indexOf(Math.max(...scores));
        const mainStoryBible = storyBibles[mainStoryBibleIndex];
        const mainAuthor = authors[mainStoryBibleIndex];

        


        

        

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

