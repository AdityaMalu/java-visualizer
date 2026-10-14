/* 0.4 Arrays */
topic('0', { no:'0.4', title:'Arrays', imp:'good', idea:`Fixed-size, indexed containers. See default values, two variables sharing one array, copying, out-of-bounds errors, and why printing an array shows gibberish.`,
actors:'Thread', stateTitle:'Heap',
codes:{a:`int[] prices = new int[4];             // 4 slots, all 0
prices[0] = 300; prices[3] = 120;
int[] alias = prices;                  // same array, second name
alias[1] = 999;                        // prices[1] is 999 too
int[] bigger = Arrays.copyOf(prices, 6); // a new, longer array
System.out.println(prices.length);     // 4 (a field, not a method)
Arrays.sort(prices);                   // sorts in place
System.out.println(prices);            // [I@1b6d3586
System.out.println(Arrays.toString(prices)); // [0, 120, 300, 999]
prices[4] = 1;                         // index 4 doesn't exist
int[][] grid = new int[3][2];          // 3 rows of 2`},
steps:[
{hl:{main:[1]}, th:[], g:[G('prices → int[4]',C('index 0..3',[['0'],['0'],['0'],['0']]))],
 say:`An <b>array</b> holds a fixed number of values of one type, side by side. <code>new int[4]</code> creates 4 slots on the heap, numbered <b>0 to 3</b>, each starting at the default value (0 for numbers, false for booleans, null for objects).`},
{hl:{main:[2]}, g:[G('prices → int[4]',C('index 0..3',[['300','hot'],['0'],['0'],['120','hot']]))],
 say:`Use <code>array[index]</code> to read or write a slot. Indexes start at 0, so the last slot is <code>length - 1</code>.`},
{hl:{main:[3,4]}, g:[G('prices, alias → same int[4]',C('index 0..3',[['300'],['999','hot'],['0'],['120']]))],
 say:`An array is an <b>object</b>. <code>alias = prices</code> copies the <b>reference</b>, not the data, so both names point to the same array. Changing <code>alias[1]</code> changes what <code>prices</code> sees.`},
{hl:{main:[5,6]}, g:[G('prices → int[4]',C('',[['300'],['999'],['0'],['120']])), G('bigger → new int[6]',C('',[['300'],['999'],['0'],['120'],['0','hot'],['0','hot']]))], log:['4'],
 say:`Arrays can't grow. To "resize", create a new one and copy (<code>Arrays.copyOf</code>). <code>length</code> is a field, so no parentheses (unlike <code>String.length()</code> and <code>list.size()</code>).`},
{hl:{main:[7,8,9]}, g:[G('prices → int[4] (sorted)',C('',[['0','hot'],['120','hot'],['300','hot'],['999','hot']]))], log:['[I@1b6d3586','[0, 120, 300, 999]'],
 say:`<code>Arrays.sort</code> sorts in place. Printing an array directly shows its type and a hash code (<code>[I</code> means "int array"), not its contents. Use <code>Arrays.toString</code>. Likewise, compare contents with <code>Arrays.equals</code>, not <code>==</code>.`},
{hl:{main:[10]}, g:[G('prices → int[4]',['valid indexes','0, 1, 2, 3'],['requested','4','bad'])], log:['java.lang.ArrayIndexOutOfBoundsException: Index 4 out of bounds for length 4'],
 say:`Java checks every index. Going past the end throws <code>ArrayIndexOutOfBoundsException</code> instead of silently corrupting memory. "Off by one" loops (<code>i &lt;= length</code>) are the usual cause.`},
{hl:{main:[11]}, g:[G('grid → int[3][2]',['grid[0]','[0, 0]'],['grid[1]','[0, 0]'],['grid[2]','[0, 0]'],['grid[1][0]','row 1, column 0'])],
 say:`A 2D array is an <b>array of arrays</b>. In real code you'll mostly use <code>ArrayList</code> (2.5), which grows automatically, but arrays remain important for performance and in coding interviews.`}
],
keep:[`Fixed size, indexes 0..length-1, default values 0/false/null.`,`Arrays are objects: assignment copies the reference; Arrays.copyOf makes a new one.`,`Print with Arrays.toString, compare with Arrays.equals; bad index → ArrayIndexOutOfBoundsException.`]}, {
  imp: 'good',
  theory: TH(`An array stores a fixed number of values of the same type in numbered slots, starting at index 0.`,
`<p>When you need many values of the same kind (ten scores, a grid of cells), an <b>array</b> keeps them together. You choose the size when creating it, and it never changes. Each slot has an <b>index</b>: the first is 0 and the last is <code>length - 1</code>. Reading or writing a slot by index is instant.</p>
<p>Arrays are objects, so an array variable holds a reference. Two variables can point to the same array, and changes through one are seen through the other.</p>`,
[[`Index`,`Position of a slot, from 0 to length − 1.`],[`length`,`Number of slots (a field: arr.length).`],[`Default values`,`0, false or null until you assign something.`],[`Arrays utility`,`java.util.Arrays: sort, copyOf, toString, equals, fill, binarySearch.`]],
[`Create: <code>new int[5]</code> or <code>int[] a = {3, 1, 2};</code>.`,`Access: <code>a[i]</code> for reading and writing.`,`Loop: <code>for (int i = 0; i &lt; a.length; i++)</code> or <code>for (int x : a)</code>.`,`Grow: create a bigger array and copy, or use ArrayList.`],
[`Use ArrayList in most application code; arrays for fixed-size data, performance-critical code and coding interviews.`,`<code>Arrays.asList</code> and <code>List.of</code> bridge arrays and lists (2.9).`],
[`Index out of bounds (often <code>i &lt;= a.length</code>).`,`Printing an array directly instead of Arrays.toString.`,`Comparing arrays with == instead of Arrays.equals.`]),
  quiz: [
    [`<code>int[] a = new int[3];</code> What is <code>a[2]</code>?`,[`null`,`0`,`Undefined garbage`,`ArrayIndexOutOfBoundsException`],1,`Numeric arrays start filled with 0.`,'E'],
    [`<code>int[] b = a; b[0] = 9;</code> What is <code>a[0]</code>?`,[`9: both names refer to one array`,`0: the assignment made b a copy`,`Compile error: b must be declared new`,`It depends on the JVM implementation`],0,`Arrays are objects; assignment copies the reference.`,'M'],
    [`How do you print an array's contents?`,[`System.out.println(arr)`,`arr.toString()`,`Arrays.toString(arr)`,`String.valueOf(arr)`],2,`Arrays don't override toString, so printing shows type@hash.`,'M'],
    [`What is the index of the last element of <code>int[] a = new int[10]</code>?`,[`10`,`9`,`11`,`0`],1,`Indexes run from 0 to length − 1.`,'E'],
    [`<code>String[] names = new String[3];</code> What does <code>names[0]</code> hold?`,[`""`,`"null"`,`null`,`It throws`],2,`Object arrays start filled with null.`,'E'],
    [`Can an array's size change after it's created?`,[`Yes, by calling add() on the array`,`No: create a new array or use ArrayList`,`Yes, by assigning a new value to length`,`Only arrays of primitives like int[]`],1,`Arrays are fixed-size.`,'E'],
    [`<code>int[] a = {5, 2, 9}; Arrays.sort(a);</code> What is a now?`,[`[9, 5, 2]`,`[5, 2, 9]`,`A new array is returned; a is unchanged`,`[2, 5, 9]`],3,`Arrays.sort sorts in place, ascending.`,'M'],
    [`Which loop prints every element safely?`,[`for (int i = 0; i &lt;= a.length; i++)`,`for (int i = 1; i &lt;= a.length; i++)`,`for (int i = 0; i &lt; a.length; i++)`,`for (int i = a.length; i &gt; 0; i--) print(a[i])`],2,`The others go out of bounds.`,'M'],
  ],
  quizAdv: [
    [`<code>int[] a = {1,2}; int[] b = {1,2};</code> What are <code>a == b</code> and <code>Arrays.equals(a, b)</code>?`,[`true, true`,`false, false`,`false, true`,`true, false`],2,`== compares references; Arrays.equals compares contents.`,'M'],
    [`<code>new int[2][3]</code> creates?`,[`One array of 6 ints`,`An array of 2 arrays, each with 3 ints`,`An array of 3 arrays, each with 2 ints`,`A 2×3 matrix object`],1,`Java has arrays of arrays; rows can even have different lengths.`,'H'],
    [`What does <code>Arrays.copyOf(a, 2)</code> return for a = [1, 2, 3, 4]?`,[`[1, 2]`,`[3, 4]`,`[1, 2, 3, 4, 0, 0]`,`It modifies a`],0,`It truncates or pads to the new length.`,'M'],
    [`Can a 2D array have rows of different lengths?`,[`No, every 2D array is always rectangular`,`Only char arrays, for storing lines of text`,`Yes: it's an array of arrays (jagged)`,`Only when built from an ArrayList of rows`],2,`int[][] g = new int[3][]; then each row can be a different length.`,'H'],
  ],
});
