module.exports = {
  prompt: async ({prompter, args}) => {
    let prompts = await prompter.prompt({
      type: "input",
      name: "description",
      message: "Describe this uservice"
    })

    return {
      jobs: args.jobs || false,
      ...prompts
    }
  }
}
