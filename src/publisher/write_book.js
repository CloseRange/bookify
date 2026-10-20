
const { setBookProgress } = require("./write_book_progress");

const { generateResponse } = require("./author_speak");

async function writeBook(prompt) {
    let step = 0;

    step += 1;
    setBookProgress(step, "Validating input");
    if (!prompt || typeof prompt !== "string") {
        throw new Error("prompt must be a non-empty string");
    }
    var response_1 = "";
    var response_2 = "";
    try {
        response_1 = await generateResponse("aria", prompt);
    } catch (error) {
        throw new Error(`Failed to generate response: ${error.message}`);
    }
    step += 1;
    setBookProgress(step, "Publishing final book");
    try {
        response_2 = await generateResponse("bennett", prompt);
    } catch (error) {
        throw new Error(`Failed to generate response: ${error.message}`);
    }
    console.log("================================");
    console.log("Response Aria:", response_1);
    console.log("================================");
    console.log("Response Bennett:", response_2);
    console.log("================================");
    

    return {
        ok: true,
        message: "Book pipeline finished",
    };
}

module.exports = {
    writeBook,
};

