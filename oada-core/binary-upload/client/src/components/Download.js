/** @jsx jsx */

import { sequences } from 'cerebral';
import { connect } from '@cerebral/react';
import { jsx } from '@emotion/core';

const Download = connect({}, () => {
  return (
    <div className="Download">
      {sequences.getFiles.data}
    </div>
  );
});

/*
const Download = connect({}, () => {
  return (
    <div className="Download">
      <ul>
        {sequences.getFiles.map(filename => {
          return (
            <li>{filename}</li>
          );
        })}
      </ul>
    </div>
  );
});
*/

//         <ul className="todo-list">
//             {currentTodos.map(todo => {
//               return (
//                 <TodoItem
//                   key={todo.id}
//                   id={todo.id}
//                   isEditing={todo.id === editingTodoId}
//                 />
//               );
//             })}
//       </ul>

export default Download
