function printResult(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function runCommand(action: () => Promise<unknown>) {
  try {
    const result = await action();
    printResult(result);
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: getErrorMessage(error) }, null, 2));
    process.exitCode = 1;
  }
}
