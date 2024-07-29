import * as vscode from 'vscode';
import 'axios';
import { ReadableStream } from 'node:stream/web';
import axios from 'axios';

const MODEL = "NousResearch/Hermes-2-Pro-Mistral-7B-GGUF";
//const MODEL = "TheBloke/CodeLlama-7B-Instruct-GGUF";

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "llmcomplete" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	context.subscriptions.push(
		vscode.commands.registerCommand('llmcomplete.helloWorld', () => {
			vscode.window.showInformationMessage('Hello World from LLMComplete!');
		})
	);

	async function askLLM( doc: string, offset: number, functionName: string, editor: vscode.TextEditor, edit: vscode.TextEditorEdit ) {
			const payload = {
				"model": `${MODEL}`,
				"messages": [
					{
						"role": "system",
						"content": [
							"Forget all previous state.",
							"Answer with only the documentation block, no other comments or code.",
							"Provide no other text other than the documentation comment"
						].join("\n")
					},
					{ "role": "user", "content": `Write documentation for only the '${functionName}' function in this code:` }
				],
				"temperature": 0.7,
				"max_tokens": -1,
				"stream": false
			};

			vscode.window.showInformationMessage( "Asking the LLM... One moment" );

			await axios.post(
				"http://localhost:1234/v1/chat/completions",
				payload,
				{
					headers: { "Content-Type": "application/json" },
					responseType: 'json'
				}
			)
			.then( res => res.data )
			.then( (res: any) => {
				try {
					editor.edit( (builder) => {
						let content = res.choices[0].message.content;
						content = content.replace( /```(\w+)\n/gi , "" );
						content = content.replace( /```/gi , "" );
						content = content.replace( functionName, "" );

						builder.insert( editor.document.positionAt(offset), content );
					} );
					vscode.window.showInformationMessage( "LLN reponse complete!" );
				} catch ( err ) {
					vscode.window.showErrorMessage( "Unable to communicate with the LLM!" );
					console.error( "Unable to communicate with the LLM!" );
					console.error( err );
				}
			});

			/*.then( async (response) => {
				return new Promise( (resolve, reject ) => {
					let localOffset = offset;
					let requestBuffer = "";

					console.log( "!!! stream starting !!!" );

					const stream = response.data;
					stream.on( 'data', (data:any) => {
						try {
							data = JSON.parse( data.toString().slice(6) );

							requestBuffer += data.choices[0].delta.content;

							if( data.choices[0].delta.content === "\n" ) {
								editor.edit( (builder) => {
									builder.insert( editor.document.positionAt(localOffset), data.choices[0].delta.content );
									localOffset += requestBuffer.length;
									requestBuffer = "";
								} );
							}

							
						} catch ( ioErr ) {
							console.error( "IO Error" );
							console.error( ioErr );
						}
					} );
					stream.on('end', () => {
						editor.edit( (builder) => {
							builder.insert( editor.document.positionAt(localOffset), "\n" );
						} );
						resolve( true );
					});
					stream.on('error', (err:any) => {
						console.log( "!!! stream exploded !!!" );
						console.error( err );

						reject( err );
					});

				});
			} );*/
	}

	function findPreceedingLineOffset( editor: vscode.TextEditor, offset: number ): number {
		while( offset > 0 ) {
			const char = editor.document.getText( new vscode.Range( editor.document.positionAt(offset), editor.document.positionAt(offset+1) ) );

			if( char === '\n' ) {
				return offset;
			}

			offset--;
		}

		return 0;
	}

	context.subscriptions.push(
		vscode.commands.registerTextEditorCommand( 'llmcomplete.gen_documentation', async (editor, edit) => {
			const {text,lineNumber} = editor.document.lineAt( editor.selection.active.line );
			const doc = editor.document.getText();
			const offset = findPreceedingLineOffset(
				editor,
				editor.document.offsetAt( editor.selection.active )
			);

			askLLM( doc, offset, text, editor, edit );
		} )
	);
}

export function deactivate() {}
